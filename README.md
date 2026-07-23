# Tapfiliate tag for Google Tag Manager Server Container

The **Tapfiliate tag** for Google Tag Manager Server Container lets you integrate Tapfiliate affiliate tracking with your server-side setup, sending clicks, conversions, and customer records directly to the [Tapfiliate REST API](https://tapfiliate.com/docs/rest/).

## Features

- **Page View (Click)**: Extracts the Referral Code from the page URL, creates a Click via the `/clicks/` endpoint, and stores the returned Click ID in a first-party cookie (`tapfiliate_cid`) with configurable domain, SameSite, HttpOnly, and expiration.
- **Conversion Track**: Sends conversion data to the `/conversions/` endpoint. Requires at least one identifier (Customer ID, Coupon, Referral Code, Click ID, Asset ID + Source ID, or Tracking ID); the tag validates this locally and aborts with `gtmOnFailure()` before making a request if none is present.
- **Customer Create**: Sends customer data to the `/customers/` endpoint. Requires a Customer ID plus at least one of the same identifiers listed above; validated the same way as Conversion Track.
- **Automap**: Each event type can automatically map its own set of fields from the incoming Event Data (see [Automap default mappings](#automap-default-mappings) below). Any value entered manually always overrides the corresponding auto-mapped value.
- **Click Meta Data & Source ID**: On Page View, optionally reads a Source ID and arbitrary meta-data values from URL query parameters and attaches them to the click request.
- **Consent Mode Support**: Optionally requires `ad_storage` consent (via Google Consent Mode or Stape's Data Tag parameter) before the tag fires.
- **Optimistic Scenario**: For Conversion Track and Customer Create, optionally returns `gtmOnSuccess()` immediately without waiting for the Tapfiliate API response, speeding up sGTM response time.

## Installation

1. **Download the Template**: Download the `template.tpl` file from this repository.
2. **Import to GTM Server Container**: In **Templates** → **Tag Templates**, click **New**, then use the **three-dot menu** → **Import** to select the downloaded file.
3. **Create a New Tag**: Go to **Tags** → **New** and select the imported **Tapfiliate** template.

## Tag Configuration

### Base Configuration

| Parameter | Description |
| :--- | :--- |
| **Event Type** | `Page View` (creates a Click ID), `Conversion Track`, or `Customer Create`. Each reveals its own configuration group below. |
| **API Key** | Your Tapfiliate account API key, sent as the `X-Api-Key` header. Found in your account settings. |
| **Referral Code URL Parameter Name** | The URL query parameter that carries the affiliate's referral code. Defaults to `ref`. Used both to create the Click ID and to auto-map the Referral Code for Conversion Track / Customer Create. |
| **Use Optimistic Scenario** | Only for Conversion Track / Customer Create. Returns `gtmOnSuccess()` immediately, without waiting for the API response. |

### Page View Configuration

Shown when **Event Type** is `Page View`.

| Parameter | Description |
| :--- | :--- |
| **Source ID URL Parameter Name** | If set, reads this URL query parameter and sends it as `source_id` with the click request. |
| **Click Meta Data Parameters** | A comma-separated list of URL query parameter names (e.g. `visitor_time,cohort`); each found value is sent under `meta_data`. |
| **Automap Click Data Parameters** | Enabled by default. Auto-maps IP, User Agent, Landing Page URL, and Referrer URL — see [Automap default mappings](#automap-default-mappings). |
| **Click ID Parameters** | Manually set `ip`, `user_agent`, `landing_page`, or `referrer`. Manual values always override the automapped ones. |

#### Cookie Settings

| Parameter | Description |
| :--- | :--- |
| **Cookie Expiration** | Number of days the `tapfiliate_cid` cookie lives. Defaults to `30`. Set this to at least your program's agreed cookie duration. |
| **Cookie Domain** | Defaults to `auto`, which computes the top-level domain from the event's `page_location` (or, if absent, the `referer` header). Can be set to a fixed top-level domain (e.g. `example.com`). |
| **Cookie SameSite** | `None` (default), `Lax`, or `Strict`. |
| **Http Only Flag** | `False` (default) or `True`. |

### Conversion Track Configuration

Shown when **Event Type** is `Conversion Track`.

| Parameter | Description |
| :--- | :--- |
| **Automap Conversion Data Parameters** | Enabled by default. Auto-maps Currency, Amount, External ID, Click ID, Referral Code, Coupon, User Agent, and IP — see [Automap default mappings](#automap-default-mappings). |
| **Conversion Parameters** | Manually set any of `coupon`, `click_id`, `referral_code`, `asset_id`, `source_id`, `external_id`, `customer_id`, `tracking_id`, `currency`, `amount`, `commission_type`, `commissions`, `program_group`, `ip`, `user_agent`. Manual values always override automap. At least one identifying field (`customer_id`, `coupon`, `referral_code`, `click_id`, `tracking_id`, or `asset_id` + `source_id`) is required, whether provided manually or via automap. |
| **Meta Data Parameters** | Arbitrary key/value pairs sent under `meta_data` (e.g. product characteristics, category, quantity). |

### Customer Create Configuration

Shown when **Event Type** is `Customer Create`.

| Parameter | Description |
| :--- | :--- |
| **Customer ID** | Required. The unique ID for this customer in your system. |
| **Customer Status** | `new` (default, E-Commerce/Generic), `trial` (SaaS/Subscription), or `lead` (Lead-gen). |
| **Automap Customer Data Parameters** | Enabled by default. Auto-maps Click ID, Referral Code, Coupon, User Agent, and IP — see [Automap default mappings](#automap-default-mappings). |
| **Customer Parameters** | Manually set any of `coupon`, `click_id`, `referral_code`, `asset_id`, `source_id`, `tracking_id`, `ip`, `user_agent`. Manual values always override automap. In addition to the required Customer ID, at least one identifying field (`coupon`, `referral_code`, `click_id`, `tracking_id`, or `asset_id` + `source_id`) is required, whether provided manually or via automap. |
| **Meta Data Parameters** | Arbitrary key/value pairs sent under `meta_data`. |

### Tag Execution Consent Settings

| Parameter | Description |
| :--- | :--- |
| **Ad Storage Consent** | `Send data always` (default), or abort the tag (calling `gtmOnSuccess()`) when `ad_storage` consent is not granted. |

## Automap default mappings

Manually entered values always override the corresponding auto-mapped value.

| Field | Event types | Source |
| :--- | :--- | :--- |
| Landing Page URL (`landing_page`) | Page View | `eventData.page_location` |
| Referrer URL (`referrer`) | Page View | `eventData.page_referrer` |
| Click ID (`click_id`) | Conversion Track, Customer Create | `eventData.tapfiliate_cid`, then the `tapfiliate_cid` server cookie, then the `tap_vid` JS cookie |
| Referral Code (`referral_code`) | Conversion Track, Customer Create | The configured Referral Code URL Parameter, then `eventData.tapfiliate_referral_code` |
| Coupon (`coupon`) | Conversion Track, Customer Create | `eventData.coupon` |
| Currency (`currency`) | Conversion Track | `eventData.currency` |
| Amount (`amount`) | Conversion Track | `eventData.value` |
| External ID (`external_id`) | Conversion Track | `eventData.transaction_id` |
| User Agent (`user_agent`) | All | `eventData.user_agent` |
| IP (`ip`) | All | `eventData.ip_override` |

## Useful links

- [Tapfiliate REST API documentation](https://support.tapfiliate.com/en/articles/12682358-how-to-integrate-with-tapfiliate-via-the-rest-api)

## Open Source

Tapfiliate tag for GTM Server Side is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
