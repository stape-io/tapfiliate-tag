const computeEffectiveTldPlusOne = require('computeEffectiveTldPlusOne');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getEventData = require('getEventData');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeString = require('makeString');
const makeInteger = require('makeInteger');
const makeNumber = require('makeNumber');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');

/*==============================================================================
==============================================================================*/

const API_VERSION = '1.6';
const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

if (data.type === 'pageview') {
  createClickId(data, eventData);
} else if (data.type === 'conversion') {
  const requestBody = getSendConversionBody(data, eventData);
  const invalidReason = validateRequestBody(data, requestBody);
  if (invalidReason) {
    log({
      Name: 'Tapfiliate',
      Type: 'Message',
      EventName: 'Conversion Track',
      Message: '🛑 [ERROR] Request was not sent.',
      Reason: invalidReason
    });
    return data.gtmOnFailure();
  }
  sendConversion(data, requestBody);
} else if (data.type === 'customer') {
  const requestBody = getCreateCustomerBody(data, eventData);
  const invalidReason = validateRequestBody(data, requestBody);
  if (invalidReason) {
    log({
      Name: 'Tapfiliate',
      Type: 'Message',
      EventName: 'Customer Create',
      Message: '🛑 [ERROR] Request was not sent.',
      Reason: invalidReason
    });
    return data.gtmOnFailure();
  }
  createCustomer(data, requestBody);
}

if (data.useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function validateRequestBody(data, payload) {
  const hasAssetSourcePair = payload.asset_id && payload.source_id;
  const hasIdentifier =
    payload.coupon ||
    payload.referral_code ||
    payload.click_id ||
    payload.tracking_id ||
    hasAssetSourcePair;

  if (data.type === 'customer') {
    if (!payload.customer_id) return 'Customer ID is required.';
    if (!hasIdentifier)
      return 'One of coupon, referral_code, click_id, tracking_id or asset_id + source_id is required.';
    return;
  } else if (data.type === 'conversion') {
    if (!payload.customer_id && !hasIdentifier)
      return 'One of customer_id, coupon, referral_code, click_id, tracking_id or asset_id + source_id is required.';
  }
}

function generateRequestUrl(data) {
  const baseUrl = 'https://api.tapfiliate.com/' + API_VERSION + '/';
  const urlByEventType = {
    pageview: baseUrl + 'clicks/',
    conversion: baseUrl + 'conversions/',
    customer: baseUrl + 'customers/'
  };

  return urlByEventType[data.type];
}

function generateRequestOptions(data) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'X-Api-Key': data.apiKey,
      'Content-Type': 'application/json'
    }
  };

  return requestOptions;
}

function createClickId(data, eventData) {
  const referralCode = parseRefCodeFromUrl(data, eventData) || eventData.tapfiliate_referral_code;
  if (!referralCode) {
    return data.gtmOnSuccess();
  }

  const requestBody = getCreateClickBody(data, eventData, referralCode);
  const requestUrl = generateRequestUrl(data);
  const requestOptions = generateRequestOptions(data);
  return sendHttpRequest(requestUrl, requestOptions, JSON.stringify(requestBody))
    .then((response) => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const responseBody = JSON.parse(response.body || '{}');
        if (!responseBody.id) {
          return data.gtmOnFailure();
        } else {
          storeClickId(data, responseBody.id);
          return data.gtmOnSuccess();
        }
      } else {
        return data.gtmOnFailure();
      }
    })
    .catch((error) => {
      return data.gtmOnFailure();
    });
}

function sendConversion(data, requestBody) {
  const requestUrl = generateRequestUrl(data);
  const requestOptions = generateRequestOptions(data);

  return sendHttpRequest(requestUrl, requestOptions, JSON.stringify(requestBody))
    .then((response) => {
      if (!data.useOptimisticScenario) {
        return response.statusCode >= 200 && response.statusCode < 300
          ? data.gtmOnSuccess()
          : data.gtmOnFailure();
      }
    })
    .catch((error) => {
      if (!data.useOptimisticScenario) {
        return data.gtmOnFailure();
      }
    });
}

function createCustomer(data, requestBody) {
  const requestUrl = generateRequestUrl(data);
  const requestOptions = generateRequestOptions(data);

  return sendHttpRequest(requestUrl, requestOptions, JSON.stringify(requestBody))
    .then((response) => {
      if (!data.useOptimisticScenario) {
        return response.statusCode >= 200 && response.statusCode < 300
          ? data.gtmOnSuccess()
          : data.gtmOnFailure();
      }
    })
    .catch((error) => {
      if (!data.useOptimisticScenario) {
        return data.gtmOnFailure();
      }
    });
}

function parseRefCodeFromUrl(data, eventData) {
  const url = getUrl(eventData);
  if (!url) return;
  const urlSearchParams = parseUrl(url).searchParams;
  return urlSearchParams[data.referralCodeKey || 'ref'];
}

function getClickId(eventData) {
  return (
    eventData.tapfiliate_cid ||
    getCookieValues('tapfiliate_cid')[0] || // Server cookie
    getCookieValues('tap_vid')[0] // JS cookie
  );
}

function storeClickId(data, clickId) {
  if (!clickId) return;

  const cookieOptions = {
    domain: getCookieDomain(data),
    samesite: data.cookieSameSite || 'none',
    path: '/',
    secure: true,
    httpOnly: !!data.cookieHttpOnly,
    'max-age': 60 * 60 * 24 * (makeInteger(data.cookieExpiration) || 30)
  };
  setCookie('tapfiliate_cid', clickId, cookieOptions, false);
}

function getAutoMapParams(data, eventData) {
  const params = {};

  if (data.type === 'pageview') {
    const landingPage = eventData.page_location || getRequestHeader('referer');
    if (landingPage) params.landing_page = landingPage;

    const referrer = eventData.page_referrer;
    if (referrer) params.referrer = referrer;
  } else {
    const clickId = getClickId(eventData);
    if (clickId) params.click_id = clickId;

    const referralCode = parseRefCodeFromUrl(data, eventData) || eventData.tapfiliate_referral_code;
    if (referralCode) params.referral_code = referralCode;

    const coupon = eventData.coupon;
    if (coupon) params.coupon = coupon;
  }

  const userAgent = eventData.user_agent;
  if (userAgent) params.user_agent = userAgent;

  const ipAddress = eventData.ip_override;
  if (ipAddress) params.ip = ipAddress;

  return params;
}

function getCreateClickBody(data, eventData, referralCode) {
  const payload = {
    referral_code: referralCode
  };

  const autoMapEnabled = data.autoMapClickData;
  if (autoMapEnabled) {
    assign(payload, getAutoMapParams(data, eventData));
  }

  const url = getUrl(eventData) || '';
  const searchParams = (parseUrl(url) || {}).searchParams || {};

  const sourceIdKey = data.sourceIdKey;
  if (sourceIdKey) {
    const sourceId = searchParams[data.sourceIdKey];
    if (sourceId) payload.source_id = sourceId;
  }

  const metaDataKeys = getType(data.metaDataKeys) === 'string' ? data.metaDataKeys.split(',') : [];
  if (metaDataKeys.length > 0) {
    metaDataKeys.forEach((key) => {
      const value = searchParams[key];
      if (value) {
        payload.meta_data = payload.meta_data || {};
        payload.meta_data[key] = value;
      }
    });
  }

  if (data.clickDataParameters) {
    data.clickDataParameters.forEach((param) => {
      if (!isValidValue(param.value)) return;

      payload[param.key] = param.value;
    });
  }

  return payload;
}

function getSendConversionBody(data, eventData) {
  const payload = {};

  const autoMapEnabled = data.autoMapConversionData;
  if (autoMapEnabled) {
    const currency = eventData.currency;
    if (currency) payload.currency = currency;

    const amount = eventData.value;
    if (isValidValue(amount)) payload.amount = makeNumber(amount || 0);

    const externalId = eventData.transaction_id;
    if (externalId) payload.external_id = externalId;

    assign(payload, getAutoMapParams(data, eventData));
  }

  if (data.conversionParameters) {
    data.conversionParameters.forEach((param) => {
      if (!isValidValue(param.key)) return;

      if (param.key === 'amount') {
        payload.amount = makeNumber(param.value || 0);
      } else {
        payload[param.key] = param.value;
      }
    });
  }

  if (data.conversionMetaDataParameters) {
    data.conversionMetaDataParameters.forEach((param) => {
      if (!param.key || !isValidValue(param.value)) return;

      payload.meta_data = payload.meta_data || {};
      payload.meta_data[param.key] = param.value;
    });
  }

  return payload;
}

function getCreateCustomerBody(data, eventData) {
  const payload = {
    customer_id: data.customerId ? makeString(data.customerId) : undefined,
    status: data.customerStatus ? makeString(data.customerStatus) : 'new'
  };

  const autoMapEnabled = data.autoMapCustomerData;
  if (autoMapEnabled) {
    assign(payload, getAutoMapParams(data, eventData));
  }

  if (data.customerParameters) {
    data.customerParameters.forEach((param) => {
      if (!isValidValue(param.key)) return;

      payload[param.key] = param.value;
    });
  }

  if (data.customerMetaDataParameters) {
    data.customerMetaDataParameters.forEach((param) => {
      if (!param.key || !isValidValue(param.value)) return;

      payload.meta_data = payload.meta_data || {};
      payload.meta_data[param.key] = param.value;
    });
  }

  return payload;
}

/*==============================================================================
  Helpers
==============================================================================*/

function getUrl(eventData) {
  return eventData.page_location || getRequestHeader('referer') || eventData.page_referrer;
}

function shouldExitEarly(data, eventData) {
  if (!isConsentGivenOrNotRequired(data, eventData)) {
    data.gtmOnSuccess();
    return true;
  }

  const url = getUrl(eventData);
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

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function assign() {
  const target = arguments[0];
  for (let i = 1; i < arguments.length; i++) {
    for (let key in arguments[i]) {
      target[key] = arguments[i][key];
    }
  }
  return target;
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '' && value === value;
}

function log(rawDataToLog) {
  rawDataToLog.TraceId = getRequestHeader('trace-id');
  logToConsole(JSON.stringify(rawDataToLog));
}
