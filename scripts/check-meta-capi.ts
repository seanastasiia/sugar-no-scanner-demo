// Explicit TEST EVENTS only. This script never creates a Stripe payment or production receipt.
const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
const pixel = process.env.META_PIXEL_ID?.trim();
const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
if (!token || !pixel || !/^\d{5,25}$/.test(pixel) || !testCode || !/^TEST\d+$/.test(testCode)) {
  throw new Error("Set META_CAPI_ACCESS_TOKEN, META_PIXEL_ID and META_CAPI_TEST_EVENT_CODE; production mode is not supported.");
}
const version = process.env.META_GRAPH_API_VERSION || "v26.0";
if (!/^v\d+\.0$/.test(version)) throw new Error("Invalid Graph API version");
const eventId = `qa_purchase_${crypto.randomUUID()}`;
const event = {
  event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: eventId,
  action_source: "website", event_source_url: new URL(process.env.APP_BASE_URL || "http://localhost:3000").origin + "/",
  user_data: { client_user_agent: "ShelfScanner-CAPI-QA/1.0", client_ip_address: "192.0.2.1" },
  custom_data: { value: 2.99, currency: "EUR" }
};
for (let attempt = 1; attempt <= 2; attempt++) {
  const response = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, {
    method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: [event], test_event_code: testCode }), signal: AbortSignal.timeout(10000)
  });
  const result = await response.json();
  console.log(JSON.stringify({ attempt, eventId, testOnly: true, status: response.status,
    eventsReceived: result.events_received, errorCode: result.error?.code }));
  if (!response.ok || result.events_received !== 1) process.exitCode = 1;
}

export {};
