// Pre-built automation script definitions for Profileo
// Each script defines a sequence of puppeteer actions

export const AUTOMATION_SCRIPTS = [
  // ─── YOUTUBE ───
  {
    id: 'youtube-watch-live',
    platform: 'YouTube',
    name: 'Watch Live Streams',
    description: 'Watch live streams on YouTube',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 30, min: 10, max: 300 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 120, min: 30, max: 600 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.youtube.com/live' },
      { action: 'wait', duration: '3-5' },
      { action: 'loop', selector: 'ytd-rich-item-renderer a#thumbnail, ytd-video-renderer a#thumbnail', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '3-5' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'youtube-watch-live-search',
    platform: 'YouTube',
    name: 'Search & Watch Live',
    description: 'Search and watch live streams',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g., gaming, music, news', required: true },
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 30, min: 10, max: 300 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 120, min: 30, max: 600 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.youtube.com/results?search_query={{keyword}}&sp=EgJAAQ%253D%253D' },
      { action: 'wait', duration: '3-5' },
      { action: 'loop', selector: 'ytd-video-renderer a#thumbnail', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '3-5' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'youtube-watch-live-like',
    platform: 'YouTube',
    name: 'Watch Live & Like',
    description: 'Watch live streams and like them',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 30, min: 10, max: 300 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 120, min: 30, max: 600 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.youtube.com/live' },
      { action: 'wait', duration: '3-5' },
      { action: 'loop', selector: 'ytd-rich-item-renderer a#thumbnail, ytd-video-renderer a#thumbnail', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'click', selector: '#top-level-buttons-computed ytd-toggle-button-renderer:first-child button, like-button-view-model button, button[aria-label*="like"]', optional: true },
        { action: 'wait', duration: '2-3' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'youtube-watch-live-chat',
    platform: 'YouTube',
    name: 'Watch Live & Chat',
    description: 'Watch live and read chat',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 3, min: 1, max: 10 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 60, min: 30, max: 600 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 300, min: 60, max: 900 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.youtube.com/live' },
      { action: 'wait', duration: '3-5' },
      { action: 'loop', selector: 'ytd-rich-item-renderer a#thumbnail, ytd-video-renderer a#thumbnail', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '5-8' },
        { action: 'scroll', direction: 'down', amount: 1 },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'scroll', direction: 'up', amount: 1 },
        { action: 'wait', duration: '2-3' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },

  // ─── TWITCH ───
  {
    id: 'twitch-watch-live',
    platform: 'Twitch',
    name: 'Watch Live Streams',
    description: 'Watch live streams on Twitch',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 60, min: 10, max: 600 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 180, min: 30, max: 900 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.twitch.tv/directory' },
      { action: 'wait', duration: '3-5' },
      { action: 'loop', selector: 'a[data-a-target="preview-card-image-link"], .tw-tower a[href^="/"]', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '3-5' },
        { action: 'click', selector: '[data-a-target="content-classification-gate-overlay-start-watching-button"], button[data-a-target="player-overlay-mature-accept"]', optional: true },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'twitch-watch-category',
    platform: 'Twitch',
    name: 'Watch by Category',
    description: 'Browse category and watch streams',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'category', label: 'Category/Game', type: 'text', placeholder: 'e.g., Just Chatting, Fortnite', required: true },
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 60, min: 10, max: 600 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 180, min: 30, max: 900 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.twitch.tv/directory' },
      { action: 'wait', duration: '3-5' },
      { action: 'type', selector: 'input[type="search"], input[aria-label="Search Input"]', text: '{{category}}', delay: 80 },
      { action: 'wait', duration: '2-3' },
      { action: 'click', selector: 'a[data-a-target="tw-box-art-card-link"], .search-result-card a', optional: true },
      { action: 'wait', duration: '2-3' },
      { action: 'loop', selector: 'a[data-a-target="preview-card-image-link"], .tw-tower a[href^="/"]', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '3-5' },
        { action: 'click', selector: '[data-a-target="content-classification-gate-overlay-start-watching-button"], button[data-a-target="player-overlay-mature-accept"]', optional: true },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'twitch-watch-live-follow',
    platform: 'Twitch',
    name: 'Watch & Follow',
    description: 'Watch live streams and follow channels',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 60, min: 10, max: 600 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 180, min: 30, max: 900 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.twitch.tv/directory' },
      { action: 'wait', duration: '3-5' },
      { action: 'loop', selector: 'a[data-a-target="preview-card-image-link"], .tw-tower a[href^="/"]', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '3-5' },
        { action: 'click', selector: '[data-a-target="content-classification-gate-overlay-start-watching-button"], button[data-a-target="player-overlay-mature-accept"]', optional: true },
        { action: 'wait', duration: '10-15' },
        { action: 'click', selector: '[data-a-target="follow-button"], button[aria-label*="Follow"]', optional: true },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },

  // ─── KICK ───
  {
    id: 'kick-watch-live',
    platform: 'Kick',
    name: 'Watch Live Streams',
    description: 'Watch live streams on Kick',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 60, min: 10, max: 600 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 180, min: 30, max: 900 },
    ],
    steps: [
      { action: 'navigate', url: 'https://kick.com/browse' },
      { action: 'wait', duration: '3-5' },
      { action: 'loop', selector: 'a[href^="/"] .stream-thumbnail, a.stream-card', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'kick-watch-category',
    platform: 'Kick',
    name: 'Watch by Category',
    description: 'Browse category and watch on Kick',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'category', label: 'Category/Game', type: 'text', placeholder: 'e.g., Just Chatting, Slots', required: true },
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 60, min: 10, max: 600 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 180, min: 30, max: 900 },
    ],
    steps: [
      { action: 'navigate', url: 'https://kick.com/categories' },
      { action: 'wait', duration: '3-5' },
      { action: 'type', selector: 'input[type="search"], input[placeholder*="Search"]', text: '{{category}}', delay: 80 },
      { action: 'wait', duration: '2-3' },
      { action: 'click', selector: 'a[href*="/category/"]', optional: true },
      { action: 'wait', duration: '2-3' },
      { action: 'loop', selector: 'a[href^="/"] .stream-thumbnail, a.stream-card', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'kick-watch-follow',
    platform: 'Kick',
    name: 'Watch & Follow',
    description: 'Watch live streams and follow on Kick',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStreams', label: 'Max Streams', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 60, min: 10, max: 600 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 180, min: 30, max: 900 },
    ],
    steps: [
      { action: 'navigate', url: 'https://kick.com/browse' },
      { action: 'wait', duration: '3-5' },
      { action: 'loop', selector: 'a[href^="/"] .stream-thumbnail, a.stream-card', maxIterations: '{{maxStreams}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '5-10' },
        { action: 'click', selector: 'button[aria-label*="Follow"], button:has(span:text("Follow"))', optional: true },
        { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },

    {
    id: 'kick-search-watch',
    platform: 'Kick',
    name: 'Search & Watch Channel',
    description: 'Go to a Kick channel, handle popups, and watch the stream',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'channel', label: 'Channel Name', type: 'text', placeholder: 'e.g., xQc', required: true },
      { key: 'watchMin', label: 'Min Watch (sec)', type: 'number', default: 60, min: 10, max: 600 },
      { key: 'watchMax', label: 'Max Watch (sec)', type: 'number', default: 300, min: 30, max: 900 },
    ],
    steps: [
      { action: 'navigate', url: 'https://kick.com/{{channel}}' },
      { action: 'wait', duration: '5-8' },
      { action: 'clickText', text: 'Accept all', optional: true },
      { action: 'wait', duration: '2-3' },
      { action: 'clickText', text: 'I am 18+', optional: true },
      { action: 'wait', duration: '2-3' },
      { action: 'clickText', text: 'Accept all', optional: true },
      { action: 'wait', duration: '10' },
      { action: 'evaluate', script: 'var v=document.querySelector("video");if(v)v.click()' },
      { action: 'wait', duration: '2' },
      { action: 'evaluate', script: '(function(){var v=document.querySelector("video");if(!v)return;var vr=v.getBoundingClientRect();var midY=vr.top+vr.height/2;var btns=Array.from(document.querySelectorAll("button")).filter(function(b){var r=b.getBoundingClientRect();return r.width>0&&r.top>=vr.top&&r.bottom<=midY&&r.left>=vr.left&&r.right<=vr.right});btns.sort(function(a,b){return b.getBoundingClientRect().right-a.getBoundingClientRect().right});if(btns.length>0)btns[0].click()})()' },
      { action: 'wait', duration: '3' },
      { action: 'evaluate', script: 'var items=document.querySelectorAll("*");for(var i=0;i<items.length;i++){if(items[i].textContent.trim()==="160p"&&items[i].children.length===0){items[i].click();break}}' },
      { action: 'wait', duration: '2-3' },
      { action: 'wait', duration: '{{watchMin}}-{{watchMax}}' },
    ]
  },

  // ─── AMAZON ───
  {
    id: 'amazon-search-details',
    platform: 'Amazon',
    name: 'Search & View Details',
    description: 'Search keyword, open item, see details',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g., wireless headphones', required: true },
      { key: 'maxItems', label: 'Max Items', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 2, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 5, min: 1, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.amazon.com' },
      { action: 'wait', duration: '2-3' },
      { action: 'type', selector: '#twotabsearchtextbox', text: '{{keyword}}', delay: 80 },
      { action: 'click', selector: '#nav-search-submit-button' },
      { action: 'waitForSelector', selector: '.s-main-slot', timeout: 15000 },
      { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
      { action: 'loop', selector: '.s-result-item[data-asin]:not(.AdHolder) h2 a', maxIterations: '{{maxItems}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'scroll', direction: 'down', amount: 3 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'amazon-search-shop',
    platform: 'Amazon',
    name: 'Search & Shop',
    description: 'Search keyword, open item and shop dialog',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g., laptop stand', required: true },
      { key: 'maxItems', label: 'Max Items', type: 'number', default: 3, min: 1, max: 10 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 2, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 5, min: 1, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.amazon.com' },
      { action: 'wait', duration: '2-3' },
      { action: 'type', selector: '#twotabsearchtextbox', text: '{{keyword}}', delay: 80 },
      { action: 'click', selector: '#nav-search-submit-button' },
      { action: 'waitForSelector', selector: '.s-main-slot', timeout: 15000 },
      { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
      { action: 'loop', selector: '.s-result-item[data-asin]:not(.AdHolder) h2 a', maxIterations: '{{maxItems}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'click', selector: '#add-to-cart-button', optional: true },
        { action: 'wait', duration: '2-3' },
        { action: 'goBack' },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'amazon-search-list',
    platform: 'Amazon',
    name: 'Search & Browse List',
    description: 'Search keyword, open item, see item list',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g., phone case', required: true },
      { key: 'maxPages', label: 'Max Pages', type: 'number', default: 3, min: 1, max: 10 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 2, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 5, min: 1, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.amazon.com' },
      { action: 'wait', duration: '2-3' },
      { action: 'type', selector: '#twotabsearchtextbox', text: '{{keyword}}', delay: 80 },
      { action: 'click', selector: '#nav-search-submit-button' },
      { action: 'waitForSelector', selector: '.s-main-slot', timeout: 15000 },
      { action: 'loop', selector: '.s-pagination-next', maxIterations: '{{maxPages}}', steps: [
        { action: 'scroll', direction: 'down', amount: 5 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '.s-pagination-next', optional: true },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'amazon-search-reviews',
    platform: 'Amazon',
    name: 'Search & Read Reviews',
    description: 'Search keyword, open item, see feedbacks',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g., bluetooth speaker', required: true },
      { key: 'maxItems', label: 'Max Items', type: 'number', default: 3, min: 1, max: 10 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 6, min: 1, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.amazon.com' },
      { action: 'wait', duration: '2-3' },
      { action: 'type', selector: '#twotabsearchtextbox', text: '{{keyword}}', delay: 80 },
      { action: 'click', selector: '#nav-search-submit-button' },
      { action: 'waitForSelector', selector: '.s-main-slot', timeout: 15000 },
      { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
      { action: 'loop', selector: '.s-result-item[data-asin]:not(.AdHolder) h2 a', maxIterations: '{{maxItems}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '#acrCustomerReviewLink, a[data-hook="see-all-reviews-link-foot"]', optional: true },
        { action: 'wait', duration: '2-3' },
        { action: 'scroll', direction: 'down', amount: 4 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'goBack' },
        { action: 'goBack' },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },

  // ─── EBAY ───
  {
    id: 'ebay-search-browse',
    platform: 'eBay',
    name: 'Search & Browse',
    description: 'Search and browse items on eBay',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g., vintage watch', required: true },
      { key: 'maxItems', label: 'Max Items', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 2, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 5, min: 1, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.ebay.com' },
      { action: 'wait', duration: '2-3' },
      { action: 'type', selector: '#gh-ac-box-input, input[type="text"]', text: '{{keyword}}', delay: 80 },
      { action: 'click', selector: '#gh-btn, input[type="submit"]' },
      { action: 'waitForSelector', selector: '.srp-results', timeout: 15000 },
      { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
      { action: 'loop', selector: '.s-item__link', maxIterations: '{{maxItems}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'scroll', direction: 'down', amount: 3 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'ebay-search-auction',
    platform: 'eBay',
    name: 'Browse Auctions',
    description: 'Search and view auction items',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g., collectible coins', required: true },
      { key: 'maxItems', label: 'Max Items', type: 'number', default: 5, min: 1, max: 15 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 6, min: 1, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.ebay.com' },
      { action: 'wait', duration: '2-3' },
      { action: 'type', selector: '#gh-ac-box-input, input[type="text"]', text: '{{keyword}}', delay: 80 },
      { action: 'click', selector: '#gh-btn, input[type="submit"]' },
      { action: 'waitForSelector', selector: '.srp-results', timeout: 15000 },
      { action: 'wait', duration: '2-3' },
      { action: 'click', selector: 'a[href*="LH_Auction"]', optional: true },
      { action: 'wait', duration: '2-3' },
      { action: 'loop', selector: '.s-item__link', maxIterations: '{{maxItems}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'scroll', direction: 'down', amount: 3 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'goBack' },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'ebay-browse-categories',
    platform: 'eBay',
    name: 'Browse Categories',
    description: 'Browse eBay category pages',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxScrolls', label: 'Max Scrolls', type: 'number', default: 10, min: 1, max: 30 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 2, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 4, min: 1, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.ebay.com/b/All-Categories/bn_21702628' },
      { action: 'wait', duration: '2-3' },
      { action: 'scroll', direction: 'down', amount: '{{maxScrolls}}' },
      { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
    ]
  },

  // ─── FACEBOOK ───
  {
    id: 'facebook-watch-like-reels',
    platform: 'Facebook',
    name: 'Watch & Like Reels',
    description: 'Watch and like reels',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxReels', label: 'Max Reels', type: 'number', default: 10, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Watch (sec)', type: 'number', default: 5, min: 2, max: 30 },
      { key: 'delayMax', label: 'Max Watch (sec)', type: 'number', default: 15, min: 3, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.facebook.com/reel' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxReels}}', steps: [
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[aria-label="Like"], [data-testid="UFI2ReactionLink"]', optional: true },
        { action: 'wait', duration: '1-2' },
        { action: 'scroll', direction: 'down', amount: 1 },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'facebook-share-reels',
    platform: 'Facebook',
    name: 'Share Reels',
    description: 'Watch and share random reels',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxReels', label: 'Max Reels', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'delayMin', label: 'Min Watch (sec)', type: 'number', default: 5, min: 2, max: 30 },
      { key: 'delayMax', label: 'Max Watch (sec)', type: 'number', default: 15, min: 3, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.facebook.com/reel' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxReels}}', steps: [
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[aria-label="Send"], [aria-label="Share"]', optional: true },
        { action: 'wait', duration: '2-3' },
        { action: 'evaluate', script: 'document.querySelector("[aria-label=\\"Cancel\\"], [aria-label=\\"Close\\"]")?.click()' },
        { action: 'wait', duration: '1-2' },
        { action: 'scroll', direction: 'down', amount: 1 },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'facebook-unfriend',
    platform: 'Facebook',
    name: 'Unfriend People',
    description: 'Unfriend random people',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxUnfriend', label: 'Max Unfriends', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 6, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.facebook.com/friends/list' },
      { action: 'wait', duration: '3-5' },
      { action: 'scroll', direction: 'down', amount: 3 },
      { action: 'wait', duration: '2-3' },
      { action: 'repeatBlock', count: '{{maxUnfriend}}', steps: [
        { action: 'click', selector: '[aria-label="More"], .uiMorePagerPrimary', optional: true },
        { action: 'wait', duration: '1-2' },
        { action: 'click', selector: 'text/Unfriend', optional: true },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
      ]},
    ]
  },
  {
    id: 'facebook-save-reels',
    platform: 'Facebook',
    name: 'Save Reels',
    description: 'Watch and save reels',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxReels', label: 'Max Reels', type: 'number', default: 10, min: 1, max: 30 },
      { key: 'delayMin', label: 'Min Watch (sec)', type: 'number', default: 5, min: 2, max: 30 },
      { key: 'delayMax', label: 'Max Watch (sec)', type: 'number', default: 12, min: 3, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.facebook.com/reel' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxReels}}', steps: [
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[aria-label="Save"], [aria-label="Save video"]', optional: true },
        { action: 'wait', duration: '1-2' },
        { action: 'scroll', direction: 'down', amount: 1 },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'facebook-watch-story',
    platform: 'Facebook',
    name: 'Watch Stories',
    description: 'Watch story',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStories', label: 'Max Stories', type: 'number', default: 10, min: 1, max: 30 },
      { key: 'delayMin', label: 'Min Watch (sec)', type: 'number', default: 3, min: 1, max: 15 },
      { key: 'delayMax', label: 'Max Watch (sec)', type: 'number', default: 8, min: 2, max: 30 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.facebook.com/stories' },
      { action: 'wait', duration: '3-5' },
      { action: 'click', selector: '.qi72231t a, [data-testid="story_card"]', optional: true },
      { action: 'wait', duration: '2-3' },
      { action: 'repeatBlock', count: '{{maxStories}}', steps: [
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[aria-label="Next"], [aria-label="Next card"]', optional: true },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'facebook-newsfeed-share',
    platform: 'Facebook',
    name: 'Share Posts',
    description: 'Browse newsfeed and share posts',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxPosts', label: 'Max Posts', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 5, min: 2, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 10, min: 3, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.facebook.com/' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxPosts}}', steps: [
        { action: 'scroll', direction: 'down', amount: 3 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[aria-label="Send this to friends or post it on your timeline."], [aria-label="Share"]', optional: true },
        { action: 'wait', duration: '2-3' },
        { action: 'click', selector: 'text/Share now', optional: true },
        { action: 'wait', duration: '2-3' },
      ]},
    ]
  },
  {
    id: 'facebook-newsfeed-like',
    platform: 'Facebook',
    name: 'Like Posts',
    description: 'Browse newsfeed and like posts',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxPosts', label: 'Max Posts', type: 'number', default: 10, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 8, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.facebook.com/' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxPosts}}', steps: [
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[aria-label="Like"]', optional: true },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },

  // ─── GOOGLE ───
  {
    id: 'google-search-browse',
    platform: 'Google',
    name: 'Search & Browse',
    description: 'Search keywords, browse and click on websites',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'keyword', label: 'Search Keyword', type: 'text', placeholder: 'e.g., best restaurants near me', required: true },
      { key: 'maxClicks', label: 'Max Clicks', type: 'number', default: 5, min: 1, max: 15 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 5, min: 2, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 15, min: 5, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.google.com' },
      { action: 'wait', duration: '2-3' },
      { action: 'type', selector: 'textarea[name="q"], input[name="q"]', text: '{{keyword}}', delay: 60 },
      { action: 'evaluate', script: 'document.querySelector("textarea[name=q], input[name=q]").form.submit()' },
      { action: 'wait', duration: '2-3' },
      { action: 'loop', selector: '#search a h3', maxIterations: '{{maxClicks}}', steps: [
        { action: 'click', selector: '__current__' },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'scroll', direction: 'down', amount: 3 },
        { action: 'wait', duration: '2-4' },
        { action: 'goBack' },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },

  // ─── INSTAGRAM ───
  {
    id: 'instagram-like',
    platform: 'Instagram',
    name: 'Like Posts',
    description: 'Instagram - Like',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxLikes', label: 'Max Likes', type: 'number', default: 10, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 8, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.instagram.com/' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxLikes}}', steps: [
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[aria-label="Like"], svg[aria-label="Like"]', optional: true },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'instagram-story',
    platform: 'Instagram',
    name: 'Watch Stories',
    description: 'Instagram - Story',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxStories', label: 'Max Stories', type: 'number', default: 15, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Watch (sec)', type: 'number', default: 3, min: 1, max: 15 },
      { key: 'delayMax', label: 'Max Watch (sec)', type: 'number', default: 8, min: 2, max: 30 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.instagram.com/' },
      { action: 'wait', duration: '3-5' },
      { action: 'click', selector: '[role="menuitem"] canvas, button[class*="story"]', optional: true },
      { action: 'wait', duration: '2-3' },
      { action: 'repeatBlock', count: '{{maxStories}}', steps: [
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: 'button[aria-label="Next"]', optional: true },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'instagram-reels-like',
    platform: 'Instagram',
    name: 'Reels - Like',
    description: 'Instagram - Reels - Like',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxReels', label: 'Max Reels', type: 'number', default: 10, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Watch (sec)', type: 'number', default: 5, min: 2, max: 30 },
      { key: 'delayMax', label: 'Max Watch (sec)', type: 'number', default: 15, min: 3, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.instagram.com/reels/' },
      { action: 'wait', duration: '3-5' },
      { action: 'click', selector: 'a[href*="/reel/"], div[role="presentation"]', optional: true },
      { action: 'wait', duration: '2-3' },
      { action: 'repeatBlock', count: '{{maxReels}}', steps: [
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[aria-label="Like"], svg[aria-label="Like"]', optional: true },
        { action: 'wait', duration: '1-2' },
        { action: 'scroll', direction: 'down', amount: 1 },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'instagram-newsfeed',
    platform: 'Instagram',
    name: 'Browse Feed',
    description: 'Browse newsfeed',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxScrolls', label: 'Max Scrolls', type: 'number', default: 20, min: 1, max: 100 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 8, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.instagram.com/' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxScrolls}}', steps: [
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
      ]},
    ]
  },

  // ─── TIKTOK ───
  {
    id: 'tiktok-save',
    platform: 'TikTok',
    name: 'Save Videos',
    description: 'Tiktok - Save',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxVideos', label: 'Max Videos', type: 'number', default: 10, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Watch (sec)', type: 'number', default: 5, min: 2, max: 30 },
      { key: 'delayMax', label: 'Max Watch (sec)', type: 'number', default: 15, min: 3, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.tiktok.com/foryou' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxVideos}}', steps: [
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[data-e2e="undefined-icon"], [aria-label="Bookmark"], [aria-label="Save to Favorites"]', optional: true },
        { action: 'wait', duration: '1-2' },
        { action: 'scroll', direction: 'down', amount: 1 },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'tiktok-newsfeed',
    platform: 'TikTok',
    name: 'Browse Feed',
    description: 'Tiktok - Newsfeed',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxVideos', label: 'Max Videos', type: 'number', default: 20, min: 1, max: 100 },
      { key: 'delayMin', label: 'Min Watch (sec)', type: 'number', default: 5, min: 2, max: 30 },
      { key: 'delayMax', label: 'Max Watch (sec)', type: 'number', default: 20, min: 5, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://www.tiktok.com/foryou' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxVideos}}', steps: [
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'scroll', direction: 'down', amount: 1 },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },

  // ─── X (TWITTER) ───
  {
    id: 'x-newsfeed-save',
    platform: 'X',
    name: 'Save Posts',
    description: 'Browse newsfeed and save posts',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxPosts', label: 'Max Posts', type: 'number', default: 10, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 8, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://x.com/home' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxPosts}}', steps: [
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[data-testid="bookmark"], [aria-label="Bookmark"]', optional: true },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'x-unfollow',
    platform: 'X',
    name: 'Unfollow Profiles',
    description: 'Unfollow random profiles',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxUnfollow', label: 'Max Unfollows', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 6, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://x.com/following' },
      { action: 'wait', duration: '3-5' },
      { action: 'scroll', direction: 'down', amount: 3 },
      { action: 'wait', duration: '2-3' },
      { action: 'repeatBlock', count: '{{maxUnfollow}}', steps: [
        { action: 'click', selector: '[data-testid$="-unfollow"], button[aria-label*="Following"]', optional: true },
        { action: 'wait', duration: '1-2' },
        { action: 'click', selector: '[data-testid="confirmationSheetConfirm"]', optional: true },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
      ]},
    ]
  },
  {
    id: 'x-retweet',
    platform: 'X',
    name: 'Retweet Posts',
    description: 'Browse newsfeed and retweet',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxPosts', label: 'Max Posts', type: 'number', default: 5, min: 1, max: 20 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 8, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://x.com/home' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxPosts}}', steps: [
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[data-testid="retweet"]', optional: true },
        { action: 'wait', duration: '1-2' },
        { action: 'click', selector: '[data-testid="retweetConfirm"]', optional: true },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'x-newsfeed-like',
    platform: 'X',
    name: 'Like Posts',
    description: 'Browse newsfeed and like posts',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxPosts', label: 'Max Posts', type: 'number', default: 10, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 8, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://x.com/home' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxPosts}}', steps: [
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[data-testid="like"]', optional: true },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'x-newsfeed',
    platform: 'X',
    name: 'Browse Feed',
    description: 'Browse newsfeed',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxScrolls', label: 'Max Scrolls', type: 'number', default: 20, min: 1, max: 100 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 8, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://x.com/home' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxScrolls}}', steps: [
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
      ]},
    ]
  },
  {
    id: 'x-like-follow',
    platform: 'X',
    name: 'Like & Follow',
    description: 'Browse and like posts, follow new profile',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'maxPosts', label: 'Max Posts', type: 'number', default: 10, min: 1, max: 50 },
      { key: 'delayMin', label: 'Min Delay (sec)', type: 'number', default: 3, min: 1, max: 30 },
      { key: 'delayMax', label: 'Max Delay (sec)', type: 'number', default: 8, min: 2, max: 60 },
    ],
    steps: [
      { action: 'navigate', url: 'https://x.com/home' },
      { action: 'wait', duration: '3-5' },
      { action: 'repeatBlock', count: '{{maxPosts}}', steps: [
        { action: 'scroll', direction: 'down', amount: 2 },
        { action: 'wait', duration: '{{delayMin}}-{{delayMax}}' },
        { action: 'click', selector: '[data-testid="like"]', optional: true },
        { action: 'wait', duration: '1-2' },
        { action: 'click', selector: '[data-testid$="-follow"]', optional: true },
        { action: 'wait', duration: '1-2' },
      ]},
    ]
  },
  {
    id: 'x-login',
    platform: 'X',
    name: 'Log In',
    description: 'Log in account',
    price: 'Free',
    type: 'system',
    params: [
      { key: 'username', label: 'Username/Email', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'text', required: true },
    ],
    steps: [
      { action: 'navigate', url: 'https://x.com/i/flow/login' },
      { action: 'wait', duration: '3-5' },
      { action: 'type', selector: 'input[autocomplete="username"], input[name="text"]', text: '{{username}}', delay: 60 },
      { action: 'click', selector: 'text/Next, button[role="button"]:has(span)' },
      { action: 'wait', duration: '2-3' },
      { action: 'type', selector: 'input[type="password"], input[name="password"]', text: '{{password}}', delay: 60 },
      { action: 'click', selector: '[data-testid="LoginForm_Login_Button"], text/Log in' },
      { action: 'wait', duration: '3-5' },
    ]
  },
]
