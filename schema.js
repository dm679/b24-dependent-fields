// schema.js
// Декларативное описание формы зависимых полей.
// Каждое поле — это объект. Видимость задаётся функцией showIf(values),
// которая получает ТЕКУЩИЕ значения всех полей. За счёт этого вложенность
// работает сама собой: если родитель скрыт, его значение пустое, и дочерние
// условия, ссылающиеся на него, тоже становятся ложными.
//
// code   — код пользовательского поля сделки в Б24 (UF_CRM_...).
//          Эти поля нужно один раз создать в настройках CRM.
// type   — select | text | number | textarea | date
// showIf — (values) => boolean. Если не задано — поле видно всегда.

window.FORM_SCHEMA = [
  {
    code: 'UF_CRM_CLIENT_TYPE',
    label: 'Тип клиента',
    type: 'select',
    placeholder: '— выберите —',
    options: [
      { value: 'individual', label: 'Физлицо' },
      { value: 'company', label: 'Юрлицо' },
      { value: 'ip', label: 'ИП' },
    ],
  },

  // --- Ветка «Юрлицо» ---
  {
    code: 'UF_CRM_COMPANY_NAME',
    label: 'Название организации',
    type: 'text',
    showIf: (v) => v.UF_CRM_CLIENT_TYPE === 'company',
  },
  {
    code: 'UF_CRM_INN',
    label: 'ИНН',
    type: 'text',
    showIf: (v) => v.UF_CRM_CLIENT_TYPE === 'company' || v.UF_CRM_CLIENT_TYPE === 'ip',
  },
  {
    code: 'UF_CRM_HAS_VAT',
    label: 'Работаете с НДС?',
    type: 'select',
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
    showIf: (v) => v.UF_CRM_CLIENT_TYPE === 'company',
  },
  {
    // ВЛОЖЕННОСТЬ 2-го уровня: видно только если выбрано Юрлицо И НДС = Да
    code: 'UF_CRM_VAT_RATE',
    label: 'Ставка НДС',
    type: 'select',
    options: [
      { value: '20', label: '20%' },
      { value: '10', label: '10%' },
      { value: '0', label: '0%' },
    ],
    showIf: (v) => v.UF_CRM_CLIENT_TYPE === 'company' && v.UF_CRM_HAS_VAT === 'yes',
  },

  // --- Ветка «Физлицо» ---
  {
    code: 'UF_CRM_PASSPORT',
    label: 'Паспорт (серия и номер)',
    type: 'text',
    showIf: (v) => v.UF_CRM_CLIENT_TYPE === 'individual',
  },
  {
    code: 'UF_CRM_BIRTH_DATE',
    label: 'Дата рождения',
    type: 'date',
    showIf: (v) => v.UF_CRM_CLIENT_TYPE === 'individual',
  },

  // --- Общее поле для всех типов, кроме «не выбрано» ---
  {
    code: 'UF_CRM_COMMENT',
    label: 'Комментарий',
    type: 'textarea',
    showIf: (v) => !!v.UF_CRM_CLIENT_TYPE,
  },
];
