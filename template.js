const computeEffectiveTldPlusOne = require('computeEffectiveTldPlusOne');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getContainerVersion = require('getContainerVersion');
const getEventData = require('getEventData');
const getRequestHeader = require('getRequestHeader');
const getRemoteAddress = require('getRemoteAddress');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const makeInteger = require('makeInteger');
const makeNumber = require('makeNumber');
const makeTableMap = require('makeTableMap');
const parseUrl = require('parseUrl');
const Promise = require('Promise');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');

/*==============================================================================
==============================================================================*/

const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

if (data.type === 'pageview') {
  createClickId(data.referralIdKey);
} else {
  sendConversion(data);
}

if (data.useOptimisticScenario) {
  data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function createClickId(ref) {
  const storedClickId = getStoredClickId();
  if (storedClickId) {
    data.gtmOnSuccess();
    return storedClickId;
  }
  if (!ref) {
    data.gtmOnFailure();
    return null;
  }

  const clickIdEndpoint = 'https://api.tapfiliate.com/1.6/clicks/';
  const endpointOptions = {
    method: 'POST',
    headers: {
      'X-Api-Key': data.apiKey,
      'Content-Type': 'application/json'
    }
  };
  const referral_code = parseRefIdFromUrl();
  const requestBody = { referral_code: referral_code };

  return sendHttpRequest(clickIdEndpoint, endpointOptions, JSON.stringify(requestBody))
    .then((response) => {
      const responseBody = JSON.parse(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (!responseBody.id) {
          log({
            Name: 'Tapfiliate',
            Type: 'Message',
            EventName: 'Conversion',
            Message: 'Something went wrong.',
            Reason: 'No ID found or created for the provided referral ID'
          });
          return data.gtmOnFailure();
        } else {
          manageClickIdCookie(responseBody.id);
          data.gtmOnSuccess();
        }
      } else if (response.statusCode >= 400) {
        return data.gtmOnFailure();
      }
    })
    .catch((error) => {
      log({
        Name: 'Tapfiliate',
        Type: 'Message',
        EventName: 'Conversion',
        Message: 'Failed to create Click ID',
        Reason: JSON.stringify(error)
      });
      return data.gtmOnFailure();
    });
}

function sendConversion(data) {
  const conversionEndpoint = 'https://api.tapfiliate.com/1.6/conversions/';
  const endpointOptions = {
    method: 'POST',
    headers: {
      'X-Api-Key': data.apiKey,
      'Content-Type': 'application/json'
    }
  };
  const requestBody = getConversionBody();

  return sendHttpRequest(conversionEndpoint, endpointOptions, JSON.stringify(requestBody))
    .then((response) => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        manageClickIdCookie('_tapfiliate_cid', 'remove');
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    })
    .catch((error) => {
      log({
        Name: 'Tapfiliate',
        Type: 'Message',
        EventName: 'Conversion',
        Message: 'API call failed or timed out',
        Reason: JSON.stringify(error)
      });
      return data.gtmOnFailure();
    });
}

function parseRefIdFromUrl() {
  const url = eventData.page_location || getRequestHeader('referer');
  if (!url) return;
  const urlSearchParams = parseUrl(url).searchParams;
  return urlSearchParams[data.referralIdKey || 'ref'];
}

function getStoredClickId() {
  return getCookieValues('_tapfiliate_cid')[0];
}

function manageClickIdCookie(clickId, action) {
  if (clickId) {
    const cookieOptions = {
      domain: getCookieDomain(data),
      samesite: data.cookieSameSite || 'none',
      path: '/',
      secure: true,
      httpOnly: !!data.cookieHttpOnly,
      'max-age':
        action === 'remove'
          ? getTimestampMillis() - 1
          : 60 * 60 * 24 * (makeInteger(data.cookieExpiration) || 30)
    };
    setCookie('_tapfiliate_cid', clickId, cookieOptions, false);
  }

  return;
}

function getConversionBody() {
  const payload = {};
  const clickId = getStoredClickId();
  const userAgent = getRequestHeader('User-Agent');
  const ipAddress = getRemoteAddress();

  if (data.additionalParameters && data.additionalParameters.length > 0) {
    data.additionalParameters.forEach((param) => {
      if (param.key && param.value) {
        payload[param.key] = param.value;
      }
    });
  }

  payload.amount = makeNumber(payload.amount || 0);

  if (clickId) payload.click_id = clickId;
  if (userAgent) payload.user_agent = userAgent;
  if (ipAddress) payload.ip = ipAddress;

  return payload;
}

/*==============================================================================
  Helpers
==============================================================================*/

function shouldExitEarly(data, eventData) {
  const url = eventData.page_location || getRequestHeader('referer');

  if (!isConsentGivenOrNotRequired(data, eventData)) {
    data.gtmOnSuccess();
    return true;
  }

  if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
    data.gtmOnSuccess();
    return true;
  }
}

function getCookieDomain(data) {
  return !data.cookieDomain || data.cookieDomain === 'auto'
    ? computeEffectiveTldPlusOne(getEventData('page_location') || getRequestHeader('referer')) ||
        'auto'
    : data.cookieDomain;
}

function enc(data) {
  if (['null', 'undefined'].indexOf(getType(data)) !== -1) data = '';
  return encodeUriComponent(makeString(data));
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function log(rawDataToLog) {
  rawDataToLog.TraceId = getRequestHeader('trace-id');
  logToConsole(JSON.stringify(rawDataToLog));
}
