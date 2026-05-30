// app.js — связка движка формы с Битрикс24.
// Два режима:
//   • открыто внутри карточки сделки (placement с ID сделки) — форма;
//   • открыто как отдельная страница (из меню) — админ-панель управления встройками.

(function () {
  var DEAL_PLACEMENT = 'CRM_DEAL_DETAIL_TAB';
  var INLINE_TYPE = 'dep_fields_form';        // код собственного типа поля (инлайн)
  var CONTAINER_FIELD = 'UF_CRM_DEP_FORM';    // поле-контейнер на сделке

  var statusEl = document.getElementById('status');
  var statusText = statusEl.querySelector('.df-status__text');
  var titleEl = document.getElementById('title');
  var adminEl = document.getElementById('admin');

  var saveTimer = null, dealId = null, form = null;
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
    var values = form.getValues(), fields = {};
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
      var deal = res.data(), initial = {};
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
      '<p class="df-admin__hint"><b>Инлайн в форму карточки</b> (рекомендуется) — ' +
      'форма появится прямо среди полей сделки, не отдельным окном:</p>' +
      '<button type="button" class="df-btn" id="embedBtn">Встроить инлайн в карточку</button>' +
      '<button type="button" class="df-btn df-btn--ghost" id="removeInlineBtn">Убрать инлайн</button>' +
      '<p class="df-admin__hint" style="margin-top:14px;">Старый вариант — отдельная вкладка:</p>' +
      '<button type="button" class="df-btn df-btn--ghost" id="unbindBtn">Удалить вкладку</button>' +
      '<button type="button" class="df-btn df-btn--ghost" id="stateBtn">Показать состояние</button>' +
      '<pre class="df-admin__log" id="adminLog"></pre>' +
      '<p class="df-admin__hint">Ниже — демо формы (без сохранения, сделка не выбрана):</p>';

    var logEl = document.getElementById('adminLog');
    function log(line) { logEl.textContent += (logEl.textContent ? '\n' : '') + line; }
    function err(prefix, res) { log('✗ ' + prefix + ': ' + res.error()); }

    var fieldHandler = new URL('field.html', location.href).href;

    // ----- Встроить инлайн -----
    function createContainerField() {
      BX24.callMethod('crm.deal.userfield.add', { fields: {
        FIELD_NAME: CONTAINER_FIELD,
        USER_TYPE_ID: INLINE_TYPE,
        EDIT_FORM_LABEL: { ru: 'Параметры клиента' },
        LIST_COLUMN_LABEL: { ru: 'Параметры клиента' },
        XML_ID: CONTAINER_FIELD,
        SHOW_IN_LIST: 'Y', EDIT_IN_LIST: 'Y'
      } }, function (res) {
        if (res.error()) {
          var e = String(res.error());
          if (e.indexOf('exist') !== -1 || e.indexOf('уже') !== -1) {
            log('✓ Поле-контейнер уже есть. Открой карточку сделки.');
          } else { err('userfield.add', res); }
        } else {
          log('✓ Готово! Открой карточку сделки — форма внутри, среди полей.');
        }
      });
    }

    document.getElementById('embedBtn').addEventListener('click', function () {
      log('Регистрирую тип поля ' + INLINE_TYPE + ' → ' + fieldHandler);
      BX24.callMethod('userfieldtype.add', {
        USER_TYPE_ID: INLINE_TYPE, HANDLER: fieldHandler,
        TITLE: 'Зависимые поля', DESCRIPTION: 'Зависимые поля сделки',
        OPTIONS: { height: 120 }
      }, function (res) {
        if (res.error()) {
          var e = String(res.error());
          if (e.indexOf('exist') !== -1 || e.indexOf('уже') !== -1) {
            log('• тип поля уже есть, создаю поле…'); createContainerField();
          } else { err('userfieldtype.add', res); }
        } else {
          log('• тип поля зарегистрирован, создаю поле…'); createContainerField();
        }
      });
    });

    // ----- Убрать инлайн -----
    document.getElementById('removeInlineBtn').addEventListener('click', function () {
      BX24.callMethod('crm.deal.userfield.list', { filter: { FIELD_NAME: CONTAINER_FIELD } }, function (res) {
        if (res.error()) { err('userfield.list', res); }
        else {
          var list = res.data() || [];
          if (list.length) {
            BX24.callMethod('crm.deal.userfield.delete', { id: list[0].ID }, function (r2) {
              log(r2.error() ? ('✗ delete поля: ' + r2.error()) : '✓ поле-контейнер удалено');
            });
          } else { log('• поля-контейнера не было'); }
        }
        BX24.callMethod('userfieldtype.delete', { USER_TYPE_ID: INLINE_TYPE }, function (r3) {
          log(r3.error() ? ('• тип поля: ' + r3.error()) : '✓ тип поля удалён');
        });
      });
    });

    // ----- Удалить старую вкладку -----
    document.getElementById('unbindBtn').addEventListener('click', function () {
      BX24.callMethod('placement.unbind', { PLACEMENT: DEAL_PLACEMENT }, function (res) {
        log(res.error() ? ('✗ unbind: ' + res.error()) : '✓ вкладка удалена');
      });
    });

    // ----- Показать состояние -----
    document.getElementById('stateBtn').addEventListener('click', function () {
      BX24.callMethod('placement.list', {}, function (res) {
        log('Встройки: ' + (res.error() ? res.error() : JSON.stringify(res.data())));
      });
      BX24.callMethod('userfieldtype.list', {}, function (res) {
        log('Типы полей: ' + (res.error() ? res.error() : JSON.stringify(res.data())));
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
      var o = (info && info.options) || {};
      var id = o.ID || o.ENTITY_VALUE_ID || o.ENTITY_ID;
      if (id) { runDealMode(id); } else { runAdminMode(); }
    });
  }

  if (typeof BX24 !== 'undefined') {
    init();
  } else {
    form = buildForm(function (code, value) { console.log('change', code, value); });
    form.setValues({});
    setStatus(null, 'Локальное демо (без Битрикс24)');
  }
})();
