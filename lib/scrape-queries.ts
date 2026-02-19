export const NICHE_QUERIES: Record<string, string[]> = {
  skool_owners: [
    `site:instagram.com "skool.com" ("community owner" OR "skool owner" OR "run a community")`,
    `site:instagram.com "skool community" ("founder" OR "coach" OR "creator" OR "entrepreneur")`,
    `site:instagram.com "skool.com/c/" ("join my community" OR "community" OR "members")`,
    `site:instagram.com ("skool group" OR "skool community") ("course" OR "coaching" OR "program")`,
    `site:instagram.com "built on skool" OR "community on skool" ("founder" OR "coach")`,
    `site:instagram.com "skool" ("community" OR "course" OR "coaching") ("founder" OR "entrepreneur" OR "coach")`,
    `site:instagram.com ("skool community" OR "skool group") "link in bio"`,
  ],
  course_creators: [
    `site:instagram.com ("online course" OR "course creator") ("enroll" OR "students" OR "link in bio")`,
    `site:instagram.com ("I created a course" OR "my course is live") ("founder" OR "entrepreneur" OR "coach")`,
    `site:instagram.com ("teach online" OR "online educator") ("course" OR "program" OR "community") "link in bio"`,
    `site:instagram.com ("course" OR "program") ("helping" OR "I help") ("entrepreneur" OR "business" OR "founder")`,
    `site:instagram.com ("digital course" OR "online program") ("coach" OR "mentor" OR "educator") ("founder" OR "startup")`,
    `site:instagram.com "course creator" ("community" OR "skool" OR "coaching") "link in bio"`,
    `site:instagram.com ("I teach" OR "learn from me") ("business" OR "entrepreneur" OR "startup") ("course" OR "program")`,
  ],
  biz_coaches: [
    `site:instagram.com ("business coach" OR "biz coach") ("founder" OR "entrepreneur" OR "startup")`,
    `site:instagram.com ("business coaching" OR "I coach") ("scale" OR "revenue" OR "growth") ("founder")`,
    `site:instagram.com ("business mentor" OR "entrepreneur coach") ("startup" OR "founder" OR "community")`,
    `site:instagram.com ("helping entrepreneurs" OR "coaching founders") ("business" OR "startup" OR "scale")`,
    `site:instagram.com ("biz coach" OR "business coach") ("community" OR "program" OR "course")`,
  ],
  fitness: [
    `site:instagram.com ("fitness coach" OR "online coach") ("program" OR "community" OR "founder")`,
    `site:instagram.com ("fitness entrepreneur" OR "gym owner") ("startup" OR "founder" OR "business")`,
    `site:instagram.com ("online fitness" OR "fitness program") ("coach" OR "founder" OR "entrepreneur")`,
    `site:instagram.com ("personal trainer" OR "fitness coach") ("online" OR "community" OR "program") ("founder")`,
    `site:instagram.com ("fitness business" OR "coaching program") ("entrepreneur" OR "startup" OR "founder")`,
  ],
  ecommerce: [
    `site:instagram.com ("ecom" OR "shopify") ("founder" OR "store owner" OR "entrepreneur")`,
    `site:instagram.com ("ecommerce founder" OR "shopify store") ("startup" OR "business" OR "entrepreneur")`,
    `site:instagram.com ("dropshipping" OR "ecom store") ("founder" OR "entrepreneur" OR "startup")`,
    `site:instagram.com ("online store" OR "ecommerce") ("founder" OR "startup" OR "entrepreneur") ("2023" OR "2024" OR "2025")`,
    `site:instagram.com ("ecom coach" OR "shopify expert") ("founder" OR "entrepreneur" OR "community")`,
  ],
  real_estate: [
    `site:instagram.com ("real estate investor" OR "rei") ("founder" OR "startup" OR "educator")`,
    `site:instagram.com ("house flipper" OR "fix and flip") ("investor" OR "founder" OR "entrepreneur")`,
    `site:instagram.com ("real estate investing" OR "rei community") ("founder" OR "coach" OR "educator")`,
    `site:instagram.com ("wholesale real estate" OR "real estate wholesaler") ("founder" OR "entrepreneur")`,
    `site:instagram.com ("real estate coach" OR "rei mentor") ("startup" OR "community" OR "program")`,
  ],
  agency_owners: [
    `site:instagram.com ("agency owner" OR "I run an agency") ("founder" OR "entrepreneur")`,
    `site:instagram.com ("marketing agency" OR "digital agency") ("founder" OR "startup" OR "owner")`,
    `site:instagram.com ("smma" OR "social media agency") ("founder" OR "entrepreneur" OR "startup")`,
    `site:instagram.com ("agency founder" OR "built an agency") ("entrepreneur" OR "startup" OR "community")`,
    `site:instagram.com ("lead gen agency" OR "ads agency") ("founder" OR "owner" OR "entrepreneur")`,
  ],
  small_biz: [
    `site:instagram.com ("small business owner" OR "business owner") ("startup" OR "founder" OR "entrepreneur")`,
    `site:instagram.com ("small business" OR "local business") ("founder" OR "startup") ("2023" OR "2024" OR "2025")`,
    `site:instagram.com ("started my business" OR "launched my business") ("entrepreneur" OR "founder" OR "startup")`,
    `site:instagram.com ("small business owner" OR "entrepreneur") ("working capital" OR "funding" OR "startup")`,
    `site:instagram.com ("business owner" OR "entrepreneur") ("startup" OR "new business") ("founder" OR "launched")`,
  ],
  trades: [
    `site:instagram.com ("electrician" OR "plumber" OR "contractor") ("founder" OR "business owner" OR "startup")`,
    `site:instagram.com ("trades business" OR "trade contractor") ("owner" OR "founder" OR "entrepreneur")`,
    `site:instagram.com ("hvac" OR "roofing" OR "plumbing") ("business owner" OR "founder" OR "startup")`,
    `site:instagram.com ("blue collar" OR "trades") ("entrepreneur" OR "business owner" OR "founder")`,
    `site:instagram.com ("contractor business" OR "trade business") ("startup" OR "founder" OR "owner")`,
  ],
  manufacturing: [
    `site:instagram.com ("manufacturer" OR "manufacturing") ("founder" OR "startup" OR "entrepreneur")`,
    `site:instagram.com ("product business" OR "physical product") ("founder" OR "startup" OR "entrepreneur")`,
    `site:instagram.com ("made in usa" OR "manufacturing startup") ("founder" OR "entrepreneur" OR "business")`,
    `site:instagram.com ("manufacturing business" OR "production company") ("founder" OR "startup" OR "owner")`,
    `site:instagram.com ("product manufacturer" OR "factory owner") ("entrepreneur" OR "founder" OR "startup")`,
  ],
};

// Simple keyword queries for Apify (searches Instagram's native search)
export const APIFY_QUERIES: Record<string, string[]> = {
  skool_owners: [
    'skool community owner',
    'skool group founder',
    'skool entrepreneur community',
  ],
  course_creators: [
    'course creator online coaching',
    'digital course creator',
    'online course entrepreneur',
  ],
  biz_coaches: [
    'business coach entrepreneur',
    'business mentor coaching',
    'biz coach helping entrepreneurs',
  ],
  fitness: [
    'fitness coach personal trainer',
    'online fitness coaching',
    'gym owner fitness entrepreneur',
  ],
  ecommerce: [
    'ecommerce shopify store owner',
    'online store founder ecom',
    'shopify entrepreneur brand',
  ],
  real_estate: [
    'real estate investor properties',
    'real estate agent entrepreneur',
    'property investor portfolio',
  ],
  agency_owners: [
    'marketing agency owner founder',
    'digital agency CEO',
    'SMMA agency entrepreneur',
  ],
  small_biz: [
    'small business owner local',
    'small biz entrepreneur startup',
    'local business founder',
  ],
  trades: [
    'contractor electrician plumber business',
    'HVAC roofing business owner',
    'construction contractor entrepreneur',
  ],
  manufacturing: [
    'manufacturer founder CEO',
    'manufacturing business owner',
    'factory production entrepreneur',
  ],
};

export const NICHE_LABELS: Record<string, string> = {
  skool_owners: 'Skool Owners',
  course_creators: 'Course Creators',
  biz_coaches: 'Biz Coaches',
  fitness: 'Fitness',
  ecommerce: 'Ecom',
  real_estate: 'Real Estate',
  agency_owners: 'Agency Owners',
  small_biz: 'Small Biz',
  trades: 'Trades',
  manufacturing: 'Manufacturing',
};
