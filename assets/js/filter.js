(function () {
  'use strict';

  const bar = document.getElementById('filter-bar');
  const list = document.getElementById('post-list');
  const listAll = document.getElementById('post-list-all');
  const pagination = document.getElementById('pagination');
  const pinnedList = document.getElementById('post-list-pinned');
  const empty = document.getElementById('filter-empty');
  const tagGroup = document.getElementById('filter-group-tags');
  if (!bar) return;

  let activeCategory = '';
  let activeTag = '';

  function isFiltering() {
    return activeCategory !== '' || activeTag !== '';
  }

  function apply() {
    const filtering = isFiltering();

    if (list) list.hidden = filtering;
    if (listAll) listAll.hidden = !filtering;
    if (pagination) pagination.hidden = filtering;
    if (pinnedList) pinnedList.hidden = filtering;

    if (!filtering) {
      if (empty) empty.classList.add('hidden');
      return;
    }

    if (!listAll) return;
    const cards = listAll.querySelectorAll('.post-card');
    let visible = 0;

    cards.forEach(function (card) {
      const cat = card.dataset.category || '';
      const tags = (card.dataset.tags || '').split(',').map(function (s) { return s.trim(); });
      const matchCat = !activeCategory || cat === activeCategory;
      const matchTag = !activeTag || tags.indexOf(activeTag) !== -1;

      if (matchCat && matchTag) {
        card.classList.remove('is-hidden');
        visible++;
      } else {
        card.classList.add('is-hidden');
      }
    });

    if (empty) empty.classList.toggle('hidden', visible !== 0);
  }

  bar.addEventListener('click', function (e) {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;

    if (btn.hasAttribute('data-filter-category')) {
      activeCategory = btn.dataset.filterCategory;
      bar.querySelectorAll('[data-filter-category]').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });

      if (tagGroup) {
        var updateTagButtons = function () {
          tagGroup.querySelectorAll('[data-filter-tag]').forEach(function (b) {
            var cats = (b.dataset.categories || '').split(',').map(function (s) { return s.trim(); });
            var visible = cats.indexOf(activeCategory) !== -1;
            b.hidden = !visible;
            if (!visible && b.dataset.filterTag === activeTag) {
              activeTag = '';
              b.classList.remove('is-active');
            }
          });
        };

        if (!activeCategory) {
          // "전체" 클릭 → 태그 그룹 슬라이드 업
          tagGroup.classList.remove('is-visible');
          activeTag = '';
          tagGroup.querySelectorAll('[data-filter-tag]').forEach(function (b) {
            b.classList.remove('is-active');
          });
        } else if (tagGroup.classList.contains('is-visible')) {
          // 이미 열려있는 상태 → collapse 후 expand
          tagGroup.classList.remove('is-visible');
          setTimeout(function () {
            updateTagButtons();
            tagGroup.classList.add('is-visible');
          }, 350);
        } else {
          // 닫혀있는 상태 → 바로 expand
          updateTagButtons();
          tagGroup.classList.add('is-visible');
        }
      }
    } else if (btn.hasAttribute('data-filter-tag')) {
      const tag = btn.dataset.filterTag;
      if (activeTag === tag) {
        activeTag = '';
        btn.classList.remove('is-active');
      } else {
        activeTag = tag;
        bar.querySelectorAll('[data-filter-tag]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
      }
    }

    apply();
  });
})();
