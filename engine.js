// engine.js
// Движок зависимых полей. Не зависит от Битрикса напрямую —
// получает схему и колбэки load/save, что упрощает тесты и перенос
// (например, позже — в инлайн прямо в поле карточки).

class DependentForm {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.root        — контейнер для рендера
   * @param {Array}       opts.schema      — массив описаний полей (см. schema.js)
   * @param {Function}    opts.onChange    — (code, value, allValues) => void
   */
  constructor({ root, schema, onChange }) {
    this.root = root;
    this.schema = schema;
    this.onChange = onChange || (() => {});
    this.values = {};
    this.controls = new Map(); // code -> { wrapper, input }
    this._build();
  }

  // Первичная отрисовка всех полей (скрытые — со схлопнутой обёрткой).
  _build() {
    this.root.innerHTML = '';
    this.schema.forEach((field) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'df-field';
      wrapper.dataset.code = field.code;

      const inner = document.createElement('div');
      inner.className = 'df-field__inner';

      const label = document.createElement('label');
      label.className = 'df-label';
      label.textContent = field.label;
      label.htmlFor = `df_${field.code}`;
      inner.appendChild(label);

      const input = this._createInput(field);
      inner.appendChild(input);

      wrapper.appendChild(inner);
      this.root.appendChild(wrapper);
      this.controls.set(field.code, { wrapper, input, field });
    });
  }

  _createInput(field) {
    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'df-input';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = field.placeholder || '— не выбрано —';
      input.appendChild(empty);
      (field.options || []).forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        input.appendChild(opt);
      });
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'df-input';
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.className = 'df-input';
      input.type = field.type === 'number' ? 'number'
        : field.type === 'date' ? 'date' : 'text';
    }
    input.id = `df_${field.code}`;

    const handler = () => this._handleInput(field.code, input.value);
    input.addEventListener('change', handler);
    if (field.type === 'text' || field.type === 'textarea' || field.type === 'number') {
      input.addEventListener('input', handler);
    }
    return input;
  }

  _handleInput(code, value) {
    this.values[code] = value;
    this._recompute();
    this.onChange(code, value, { ...this.values });
  }

  // Пересчёт видимости. Делаем в несколько проходов, потому что скрытие
  // родителя может скрыть и потомка (вложенность любой глубины).
  _recompute() {
    let changed = true;
    let guard = 0;
    while (changed && guard < 20) {
      changed = false;
      guard += 1;
      this.controls.forEach(({ wrapper, input, field }) => {
        const visible = field.showIf ? !!field.showIf(this.values) : true;
        const wasVisible = wrapper.classList.contains('is-visible');
        if (visible === wasVisible) return;

        changed = true;
        if (visible) {
          wrapper.classList.add('is-visible');
        } else {
          wrapper.classList.remove('is-visible');
          // Чистим значение скрытого поля, чтобы оно не «тянуло» потомков.
          if (this.values[field.code]) {
            this.values[field.code] = '';
            input.value = '';
            this.onChange(field.code, '', { ...this.values });
          }
        }
      });
    }
  }

  // Загрузить значения извне (из сделки) и отрисовать.
  setValues(values) {
    this.values = { ...values };
    this.controls.forEach(({ input }, code) => {
      input.value = this.values[code] != null ? this.values[code] : '';
    });
    this._recompute();
  }

  getValues() {
    return { ...this.values };
  }
}

window.DependentForm = DependentForm;
