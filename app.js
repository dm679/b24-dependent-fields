// app.js — связка движка формы с Битрикс24.
// Два режима:
//   • открыто внутри карточки сделки (placement CRM_DEAL_DETAIL_TAB) — форма;
//   • открыто как отдельная страница (из меню) — админ-панель: привязка
//     вкладки в карточку сделки + список текущих встроек.

(function () {
  var DEAL_PLACEMENT = 'CRM_DEAL_DETAIL_TAB';

  var statusEl = document.getElementById('status');
  var statusText = statusEl.querySelector('.df-status__text');
  var titleEl = document.getElementById('title');
  var adminEl = document.getElementById('admin');

  var saveTimer = null;
  var dealId = null;
  var form = null;

  var FIELD_CODES = window.FORM_SCHEMA.map(function (f) { return f.code; });

  function setStatus(state, text) {
    statusEl.classList.remove('is-saving', 'is-saved', 'is-error');
    if (state) statusEl.classList.add('is-' + state);
    statusText.textContent = text;
  }

  function buildForm(onChange) {
    return new DependentForm({
      root: document.getElementById('fields'),
      schema: window.FORM_SCHEMA,
      onChange: onChange || function () {},
    });
  }

  // ---------- режим сделки ----------
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    setStatus('saving', 'Сохранение…');
    saveTimer = setTimeout(saveNow, 600);
  }

  function saveNow() {
    if (!dealId) return;
    var values = form.getValues();
    var fields = {};
    FIELD_CODES.forEach(function (code) { fields[code] = values[code] || ''; });
    BX24.callMethod('crm.deal.update', { id: dealId, fields: fields }, function (res) {
      if (res.error()) { console.error(res.error()); setStatus('error', 'Ошибка сохранения'); }
      else { setStatus('saved', 'Сохранено'); }
    });
  }

  function runDealMode(id) {
    dealId = id;
    titleEl.textContent = 'Параметры клиента';
    form = buildForm(function () { scheduleSave(); });
    BX24.callMethod('crm.deal.get', { id: dealId }, function (res) {
      if (res.error()) { setStatus('error', 'Не удалось загрузить сделку'); return; }
      var deal = res.data();
      var initial = {};
      FIELD_CODES.forEach(function (code) { initial[code] = deal[code] || ''; });
      form.setValues(initial);
      setStatus('saved', 'Готово');
    });
    if (BX24.fitWindow) BX24.fitWindow();
  }

  // ---------- админ-режим ----------
  function runAdminMode() {
    titleEl.textContent = 'Настройка приложения';
    adminEl.style.display = 'block';
    adminEl.innerHTML =
      '<p class="df-admin__hint">Приложение открыто как отдельная страница. ' +
      'Чтобы оно появилось <b>вкладкой в карточке сделки</b>, нажмите кнопку — ' +
      'привяжем встройку <code>' + DEAL_PLACEMENT + '</code>.</p>' +
      '<button type="button" class="df-btn" id="bindBtn">Привязать вкладку в карточку сделки</button>' +
      '<button type="button" class="df-btn df-btn--ghost" id="listBtn">Показать текущие встройки</button>' +
      '<pre class="df-admin__log" id="adminLog"></pre>' +
      '<p class="df-admin__hint">Ниже — демо формы (без сохранения, т.к. сделка не выбрана):</p>';

    var logEl = document.getElementById('adminLog');
    function log(line) { logEl.textContent += (logEl.textContent ? '\n' : '') + line; }

    var handler = new URL('index.html', location.href).href;

    document.getElementById('bindBtn').addEventListener('click', function () {
      log('Привязываю ' + DEAL_PLACEMENT + ' → ' + handler);
      BX24.callMethod('placement.bind', {
        PLACEMENT: DEAL_PLACEMENT,
        HANDLER: handler,
        TITLE: 'Параметры клиента',
        DESCRIPTION: 'Зависимые поля сделки'
      }, function (res) {
        if (res.error()) {
          var e = String(res.error());
          if (e.indexOf('exist') !== -1 || e.indexOf('already') !== -1) {
            log('✓ Уже привязано. Откройте карточку сделки (обновите страницу).');
          } else {
            log('✗ Ошибка: ' + e);
          }
        } else {
          log('✓ Готово! Открой любую сделку — вкладка «Параметры клиента» наверху.');
        }
      });
    });

    document.getElementById('listBtn').addEventListener('click', function () {
      BX24.callMethod('placement.list', {}, function (res) {
        if (res.error()) { log('✗ placement.list: ' + res.error()); return; }
        var data = res.data();
        log('Текущие встройки: ' + (JSON.stringify(data) || '[]'));
      });
    });

    // демо-форма
    form = buildForm(function (code, value) { console.log('demo change', code, value); });
    form.setValues({});
    setStatus(null, 'Режим настройки (сделка не выбрана)');
    if (BX24.fitWindow) BX24.fitWindow();
  }

  // ---------- старт ----------
  function init() {
    BX24.init(function () {
      var info = BX24.placement.info ? BX24.placement.info() : null;
      var placement = info && info.placement;
      var id = info && info.options && info.options.ID;

      if (placement === DEAL_PLACEMENT && id) {
        runDealMode(id);
      } else if (id) {
        // на всякий случай: вдруг placement называется иначе, но ID сделки есть
        runDealMode(id);
      } else {
        runAdminMode();
      }
    });
  }

  if (typeof BX24 !== 'undefined') {
    init();
  } else {
    // локальное демо без Битрикса
    form = buildForm(function (code, value) { console.log('change', code, value); });
    form.setValues({});
    setStatus(null, 'Локальное демо (без Битрикс24)');
  }
})();
