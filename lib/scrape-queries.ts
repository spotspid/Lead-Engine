export const NICHE_QUERIES: Record<string, string[]> = {
  skool_owners: [
    'site:instagram.com "skool.com" ("community owner" OR "skool owner" OR "run a community")',
  ],
  course_creators: [
    'site:instagram.com ("course creator" OR "I teach" OR "my course") ("founder" OR "coach" OR "educator")',
  ],
  biz_coaches: [
    'site:instagram.com ("business coach" OR "biz coach") ("founder" OR "entrepreneur" OR "startup")',
  ],
  fitness: [
    'site:instagram.com ("fitness coach" OR "online coach") ("program" OR "community" OR "founder")',
  ],
  ecommerce: [
    'site:instagram.com ("ecom" OR "shopify" OR "e-commerce") ("founder" OR "store owner" OR "entrepreneur")',
  ],
  real_estate: [
    'site:instagram.com ("real estate investor" OR "rei" OR "house flipper") ("founder" OR "startup" OR "educator")',
  ],
  agency_owners: [
    'site:instagram.com ("agency owner" OR "I run an agency" OR "marketing agency") ("founder" OR "entrepreneur")',
  ],
  small_biz: [
    'site:instagram.com ("small business owner" OR "business owner") ("startup" OR "founder" OR "entrepreneur")',
  ],
  trades: [
    'site:instagram.com ("contractor" OR "electrician" OR "plumber") ("business owner" OR "founder" OR "entrepreneur")',
  ],
  manufacturing: [
    'site:instagram.com ("manufacturer" OR "manufacturing") ("founder" OR "CEO" OR "entrepreneur")',
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
