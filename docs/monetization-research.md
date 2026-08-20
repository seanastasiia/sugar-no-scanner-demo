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
- Copy says `View at Barbora · check current price`, never `cheaper` unless a licensed current-price comparison actually proves it.
- Checkout copy saves an alternative for next time rather than pushing an online reorder while the user is already in a store.
- Affiliate disclosures must be added before any tracked/paid link is introduced.

## Recommended investor answer

“The retailer CTA is included because it is part of the commercial hypothesis, but we are not treating it as the core value or forecasting revenue from it yet. Amazon grocery economics are thin, Instacart is not a Latvia route and Barbora has no public program we can rely on. The prototype lets us measure intent while keeping the independent Match untouched.”
