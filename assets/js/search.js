(function () {
  'use strict';

  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input || !results || typeof SimpleJekyllSearch === 'undefined') return;

  const postList = document.getElementById('post-list');

  const template =
    '<a href="{url}" class="search-result">' +
    '<div class="search-result__title">{title}</div>' +
    '{excerpt}' +
    '</a>';

  SimpleJekyllSearch({
    searchInput: input,
    resultsContainer: results,
    json: '/search.json',
    searchResultTemplate: template,
    templateMiddleware: function (prop, value, template) {
      if (prop === 'excerpt') {
        return value ? '<div class="search-result__excerpt">' + value + '</div>' : '';
      }
      return undefined;
    },
    noResultsText: '<div class="search-result"><div class="search-result__excerpt">No results.</div></div>',
    limit: 20,
    fuzzy: false,
    exclude: []
  });

  // Hide the full post list while searching
  input.addEventListener('input', function () {
    const hasQuery = input.value.trim().length > 0;
    if (postList) postList.style.display = hasQuery ? 'none' : '';
  });
})();
