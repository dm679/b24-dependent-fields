// setup-fields.js
// Автосоздание недостающих пользовательских полей сделки по схеме.
// Использует REST: crm.deal.userfield.list / crm.deal.userfield.add.
// Поля создаются СТРОКОВЫМИ (и т.п.), т.к. выпадашки рисует наша форма,
// а в поле сохраняется «сырое» значение (individual/company/...).

(function () {
  // Сопоставление типов из schema.js -> USER_TYPE_ID Битрикса.
  function userTypeId(type) {
    switch (type) {
      case 'number': return 'double';
      case 'date': return 'date';
      // select/text/textarea — всё строка, UI у нас свой.
      default: return 'string';
    }
  }

  function buildAddPayload(field) {
    const fields = {
      FIELD_NAME: field.code,            // должен начинаться с UF_CRM_
      USER_TYPE_ID: userTypeId(field.type),
      EDIT_FORM_LABEL: { ru: field.label, en: field.label },
      LIST_COLUMN_LABEL: { ru: field.label, en: field.label },
      XML_ID: field.code,
      SHOW_IN_LIST: 'Y',
      EDIT_IN_LIST: 'Y',
      MULTIPLE: 'N',
      MANDATORY: 'N',
    };
    if (field.type === 'textarea') {
      fields.SETTINGS = { ROWS: 3 };
    }
    return { fields };
  }

  /**
   * Создаёт все недостающие поля.
   * @param {Array}    schema  — window.FORM_SCHEMA
   * @param {Function} onLog   — (line) => void, прогресс
   * @param {Function} onDone  — (result) => void, итог { created, existed, errors }
   */
  function ensureDealFields(schema, onLog, onDone) {
    onLog = onLog || (() => {});
    onDone = onDone || (() => {});

    // 1) Узнаём уже существующие коды.
    BX24.callMethod('crm.deal.userfield.list', {}, (res) => {
      if (res.error()) {
        onLog('Ошибка чтения списка полей: ' + res.error());
        onDone({ created: [], existed: [], errors: [String(res.error())] });
        return;
      }
      const existingCodes = (res.data() || []).map((f) => f.FIELD_NAME);
      const toCreate = schema.filter((f) => existingCodes.indexOf(f.code) === -1);
      const existed = schema
        .filter((f) => existingCodes.indexOf(f.code) !== -1)
        .map((f) => f.code);

      existed.forEach((c) => onLog('• уже есть: ' + c));

      if (toCreate.length === 0) {
        onLog('Все поля уже существуют — создавать нечего.');
        onDone({ created: [], existed, errors: [] });
        return;
      }

      // 2) Создаём недостающие одним батчем.
      const calls = {};
      toCreate.forEach((f) => {
        calls['add_' + f.code] = ['crm.deal.userfield.add', buildAddPayload(f)];
      });

      BX24.callBatch(calls, (batchRes) => {
        const created = [];
        const errors = [];
        toCreate.forEach((f) => {
          const r = batchRes['add_' + f.code];
          if (r && !r.error()) {
            created.push(f.code);
            onLog('✓ создано: ' + f.code);
          } else {
            const msg = r ? String(r.error()) : 'нет ответа';
            errors.push(f.code + ': ' + msg);
            onLog('✗ ошибка: ' + f.code + ' — ' + msg);
          }
        });
        onDone({ created, existed, errors });
      });
    });
  }

  window.ensureDealFields = ensureDealFields;
})();
