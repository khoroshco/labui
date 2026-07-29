/* Пропсы, которыми снимаются эталоны: одни и те же для DC-снапшотов и паритета React.
 * У части компонентов дефолтов не хватает даже на видимую картинку (контейнер без
 * содержимого, карточка без сообщений) — снимок пустоты ничего не сторожит. */
export const FIXTURES = {
  Island: {
    rows: [
      { type: 'text', label: 'Название', value: 'Осенний сейл' },
      { type: 'text', label: 'erid', value: '2Vtzqx', nums: true },
      { type: 'toggle', label: 'Запекать в растр', checked: true },
      { type: 'segmented', label: 'Формат', options: ['JPG', 'PNG', 'WEBP'], value: 1 },
      { type: 'action', label: 'Выгрузить' },
    ],
  },
  PinCard: {
    author: 'Марина Ковалёва',
    messages: [
      { name: 'Марина Ковалёва', text: 'Логотип уезжает за охранное поле на мобильном.' },
      { name: 'Пётр Соколов', text: 'Поправил, посмотри.' },
    ],
  },
  Skeleton: { shape: 'line', width: '140px', height: '12px' },
};
