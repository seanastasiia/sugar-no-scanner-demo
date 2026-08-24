# Public Latvia shelf benchmark set — 2026-08-24

This create-only list records the public sources used by the manually dispatched `Latvia public shelf benchmark` GitHub Actions workflow. The workflow downloads them only to an ephemeral runner and uploads a metadata-only recognition report, not the images.

| Case | Role | Source and licence context |
| --- | --- | --- |
| `riga-mayonnaise-3843` | close multi-SKU shelf | [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:16-08-30-Mayonnaise-Supermarkt-Riga-RR2_3843.jpg), Riga supermarket shelf, CC BY-SA 3.0 AT / GFDL as stated on the file page |
| `riga-mayonnaise-3846` | second close multi-SKU shelf angle | [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:16-08-30-Mayonnaise-Supermarkt-Riga-RR2_3846.jpg), Riga supermarket shelf, CC BY-SA 3.0 AT / GFDL as stated on the file page |
| `rimi-bauska-interior` | far-distance negative/stress case | [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Interiors_of_Rimi_supermarket_in_Bauska_01.jpg), Bauska Rimi interior, CC BY-SA 4.0 |
| `latvia-checkout-lsm` | real Latvian staffed checkout belt | [LSM article](https://eng.lsm.lv/article/economy/economy/18.02.2025-not-much-hope-for-cheaper-groceries-in-latvia-this-year.a588227/); used as a transient test input only |
| `rimi-skanste-checkout` | Latvian self-checkout / impulse-shelf stress case | [Rimi Latvia announcement](https://www.rimi.lv/jaunumi/riga-durvis-ver-jauns-rimi-veikals-skanste); used as a transient test input only |

The two mayonnaise frames are the only close, label-readable shelves in this public set. The other three intentionally test honest empty/low-recall behavior at distances unlike the intended shopper interaction. They must not be averaged into a claim that the scanner recognizes arbitrary Latvian shelves.

The next product benchmark remains 12 manually ground-truthed frames captured at approximately 0.5–1.5 m: six category shelves from Rimi/Maxima, two repeated-facing scenes, one mixed-category scene, one glare/occlusion scene, one data-poor product and one staffed checkout belt.
