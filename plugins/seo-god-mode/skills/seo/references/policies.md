# What Google's policies actually say

Read before any programmatic, AI-assisted or link-building plan. Paraphrased; check the source pages when a decision hinges on wording (policies change).

Sources:
- Spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- AI-generated content guidance (Feb 2023): https://developers.google.com/search/blog/2023/02/google-search-and-ai-content
- AI features and your website: https://developers.google.com/search/docs/appearance/ai-features
- Helpful, reliable, people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Qualifying outbound links: https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links

## How content is produced does not matter; what it is for does

Google evaluates quality, not whether a human or a model wrote it. Using automation, AI included, to generate content whose primary purpose is manipulating rankings is spam. AI content that is helpful and original is fine.

## Scaled content abuse (March 2024)

Generating many pages primarily to manipulate rankings and not to help users, with little or no added value, regardless of whether automation, humans or both produced them. Examples: many pages generated without adding value; scraping or stitching content from other sources; pages that pretend to answer queries but do not.
→ Volume itself is not the violation; unoriginal, low-value pages are. Every page needs an element the other results lack.

## Doorway abuse

Sites or pages created to rank for specific, similar queries that funnel users to another page or offer little unique value. Google's own example: pages targeted at specific regions or cities that funnel users to one page. Also: substantially similar pages closer to search results than a clearly defined, browsable hierarchy.
→ City/product/competitor pattern pages are fine only if each variant says something only it can say.

## Site reputation abuse

Publishing third-party pages on a host site to exploit the host's ranking signals, when the content has little oversight or relationship to the site's purpose (e.g. coupon or casino sections on a news site). Google clarified in late 2024 that first-party involvement or oversight does not make it acceptable if the purpose is to exploit the host's signals.

## Expired domain abuse

Buying an expired domain and repurposing it mainly to rank low-value content on its old reputation.

## Link spam

Links intended to manipulate rankings: buying or selling links that pass ranking credit, excessive link exchanges ("link to me and I'll link to you"), large-scale article campaigns with keyword-rich anchors, automated link creation, required links in terms or widgets.
Paid or sponsored links must be qualified with `rel="sponsored"` (or `nofollow`); user-generated links with `rel="ugc"`. A compliant paid link therefore passes no ranking credit by design. The usual outcome of an unqualified paid link is not a penalty but a discounted link: money for nothing.
→ A few swaps between businesses that genuinely belong together are editorial; a ring of reciprocal links is a footprint.

## Other spam categories to know

Cloaking, sneaky redirects, hidden text and links, keyword stuffing, thin affiliate pages without added value, user-generated spam, misleading functionality, scraped content, machine-generated traffic (automated queries to Google), and manipulating rankings through fake reviews. Also: hacked content and malware.

## AI Overviews and AI Mode

Google states there are no additional requirements and no special optimisations to appear in AI features: the same SEO best practices apply (crawlable, indexable, snippet-eligible pages; important content in text; good page experience; structured data matching visible content). Controls: `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex` limit what can be shown. `Google-Extended` in robots.txt controls use for Gemini training and grounding but not inclusion in Search or AI Overviews.
→ An "llms.txt" or special AI markup sprint is not a Google lever. Spend the time on pages worth citing and on being cited by the pages engines already read.

## Manual actions

If traffic collapses on a specific date across the whole site, check Search Console → Security & Manual Actions before anything else. A manual action names the policy; fix it, then file a reconsideration request (the owner submits).
