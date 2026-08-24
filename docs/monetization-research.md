# Monetization and independence notes

These links support positioning; program availability and rates must be rechecked before any commercial claim or launch.

## Current public evidence

- [Amazon Associates commission statement](https://affiliate-program.amazon.com/help/node/topic/GRXPHT8U84RAYDXZ): Grocery and Amazon Fresh are listed at 1%. On a €3 item that is roughly €0.03 before returns or attribution loss. Amazon is therefore unlikely to fund the feature at single-item basket size.
- [Instacart affiliate program](https://company.instacart.com/affiliate): its developer/affiliate economics are tied to the United States and Canada, so it is not a Latvia-demo path even if the stated percentage is attractive.
- [Wolt Latvia affiliate page](https://explore.wolt.com/en/lva/affiliates): the program is available through TradeDoubler, but a public Latvia commission rate is not shown. Treat it as a future commercial conversation, not demo revenue.
- No public Barbora affiliate terms were identified for this prototype. The app uses ordinary exact product links, stores `affiliate: false` and makes no revenue claim.
- [Yuka independence](https://yuka.io/en/independence/) and [Yuka scanning help](https://help.yuka.io/l/en/article/xqg1ntmkgl-how-scan-android): Yuka’s product story reinforces the importance of separating scoring from commercial influence.

## Product decision

The primary hypothesis is that instant comparison has user value. Monetization is measured separately through `retailer_link_clicked` and future retailer agreements.

Guardrails:

- Match and similar-product order never depend on affiliate status or commission.
- The retailer block is visually and semantically separate from Match.
- Copy may say `Cheaper at Barbora` and offer `Buy cheaper at Barbora` only when one frame contains an unambiguous shelf price, the Barbora page is an exact SKU/pack-size match and its freshly fetched price is lower. Without a shelf label the price module stays hidden; without an exact retailer SKU it shows the camera-read shelf price only and no retailer link.
- One connected retailer is not a market-wide comparison. Never say `best price` until at least two comparable, permitted and fresh retailer sources are available.
- Checkout keeps comparison available without pushing an online reorder or asking the user to save a product while already in a store.
- Affiliate disclosures must be added before any tracked/paid link is introduced.

## Recommended investor answer

“The retailer CTA is included because it is part of the commercial hypothesis, but we are not treating it as the core value or forecasting revenue from it yet. The prototype can read a shelf label and check the exact Barbora page, while being explicit that one retailer is not a best-price engine. Amazon grocery economics are thin, Instacart is not a Latvia route and Barbora has no public affiliate program we can rely on. We can measure retailer intent while keeping the independent Match untouched.”
