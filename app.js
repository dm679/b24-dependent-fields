// app.js — связка движка формы с Битрикс24 (чтение/запись UF-полей сделки).

(function () {
  const statusEl = document.getElementById('status');
  const statusText = statusEl.querySelector('.df-status__text');

  function setStatus(state, text) {
    statusEl.classList.remove('is-saving', 'is-saved', 'is-error');
    if (state) statusEl.classList.add('is-' + state);
    statusText.textContent = text;
  }

  // Коды полей, которые читаем/пишем — берём прямо из схемы.
  const FIELD_CODES = window.FORM_SCHEMA.map((f) => f.code);

  // Дебаунс-сохранение, чтобы не дёргать API на каждый символ.
  let saveTimer = null;
  let dealId = null;
  let form = null;

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    setStatus('saving', 'Сохранение…');
    saveTimer = setTimeout(saveNow, 600);
  }

  function saveNow() {
    if (!dealId) return;
    const values = form.getValues();
    const fields = {};
    FIELD_CODES.forEach((code) => { fields[code] = values[code] || ''; });

    BX24.callMethod('crm.deal.update', { id: dealId, fields }, (res) => {
      if (res.error()) {
        console.error(res.error());
        setStatus('error', 'Ошибка сохранения');
      } else {
        setStatus('saved', 'Сохранено');
      }
    });
  }

  function loadDeal() {
    BX24.callMethod('crm.deal.get', { id: dealId }, (res) => {
      if (res.error()) {
        setStatus('error', 'Не удалось загрузить сделку');
        return;
      }
      const deal = res.data();
      const initial = {};
      FIELD_CODES.forEach((code) => { initial[code] = deal[code] || ''; });
      form.setValues(initial);
      setStatus('saved', 'Готово');
    });
  }

  function init() {
    BX24.init(() => {
      // Узнаём ID сделки, в карточке которой открыта вкладка приложения.
      const placement = BX24.placement.info();
      dealId = placement && placement.options && placement.options.ID;

      form = new DependentForm({
        root: document.getElementById('fields'),
        schema: window.FORM_SCHEMA,
        onChange: () => scheduleSave(),
      });

      if (dealId) {
        loadDeal();
        BX24.fitWindow(); // подгоняем высоту фрейма под контент
      } else {
        // Открыто вне карточки сделки — показываем форму в демо-режиме.
        setStatus(null, 'Демо-режим (нет ID сделки)');
        form.setValues({});
      }
    });
  }

  // Если SDK доступен (страница открыта как приложение Б24) — инициализируемся,
  // иначе работаем как локальное демо.
  if (typeof BX24 !== 'undefined') {
    init();
  } else {
    form = new DependentForm({
      root: document.getElementById('fields'),
      schema: window.FORM_SCHEMA,
      onChange: (code, value) => console.log('change', code, value),
    });
    form.setValues({});
    setStatus(null, 'Локальное демо (без Битрикс24)');
  }
})();
