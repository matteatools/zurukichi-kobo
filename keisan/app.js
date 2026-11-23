'use strict';
const el = id => document.getElementById(id);
let size = 'A4';
let selectedStages = [stages[0]];
let answers = false;
let items = [];
const stageDecks = new Map();
let stageRound = [];
const upcoming = [];

function selectOptions(id, values) {
  el(id).replaceChildren(...values.map(value => new Option(value, value)));
}
function selectGrade() {
  const grade = el('grade').selectedIndex + 1;
  const choices = stages.filter(stage => stage.grade === grade);
  const groups = new Map();
  const controls = [];
  for (const stage of choices) {
    if (!groups.has(stage.topic)) {
      const group = document.createElement('details');
      const heading = document.createElement('summary');
      heading.textContent = stage.topic;
      group.open = !groups.size;
      if (stage.topic === '3つの かず') group.className = 'three';
      group.append(heading, document.createElement('div'));
      groups.set(stage.topic, group);
    }
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !controls.length;
    input.onchange = updateSelection;
    label.append(input, stage.label);
    groups.get(stage.topic).lastChild.append(label);
    controls.push({input, stage});
  }
  function updateSelection() {
    selectedStages = controls.filter(c => c.input.checked).map(c => c.stage);
    for (const {input} of controls) input.disabled = selectedStages.length === 1 && input.checked;
    for (const [topic,group] of groups) {
      const count = selectedStages.filter(stage => stage.topic === topic).length;
      group.firstChild.textContent = topic + (count ? '（'+count+'）' : '');
    }
    shuffle();
  }
  el('level').replaceChildren(...groups.values());
  updateSelection();
}
function buttons(id, names, action, colors = []) {
  const group = el(id);
  names.forEach((name, i) => {
    const button = document.createElement('button');
    button.textContent = name;
    button.setAttribute('aria-pressed', i === 0);
    if (colors[i]) button.style.setProperty('--ink', colors[i]);
    button.onclick = () => {
      for (const sibling of group.children) sibling.setAttribute('aria-pressed', sibling === button);
      action(i);
    };
    group.append(button);
  });
}
function shuffled(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function nextProblem() {
  if (upcoming.length) return upcoming.pop();
  if (!stageRound.length) stageRound = shuffled(selectedStages);
  const stage = stageRound.pop();
  if (!stageDecks.get(stage)?.length) stageDecks.set(stage, shuffled(stage.bank));
  return stageDecks.get(stage).pop();
}
function blankAnswer(value) {
  const answer = document.createElement('strong');
  answer.className = 'answer';
  answer.append(math(value));
  return answer;
}
function math(text, replacement) {
  const content = document.createDocumentFragment();
  for (const part of text.split(/([0-9□]+\/[0-9□]+)/)) {
    if (!part.includes('/')) {
      if (replacement !== undefined && part.includes('□')) {
        const [left,right] = part.split('□');
        content.append(left,blankAnswer(replacement),right);
      } else content.append(part);
      continue;
    }
    const frac = document.createElement('span');
    frac.className = 'fraction';
    const [top,bottom] = part.split('/');
    frac.setAttribute('aria-label',bottom+'ぶんの'+top);
    for (const value of [top,bottom]) {
      const digit = document.createElement('span');
      if (value === '□' && replacement !== undefined) digit.append(blankAnswer(replacement));
      else digit.textContent = value;
      frac.append(digit);
    }
    content.append(frac);
  }
  return content;
}
function row(item, index) {
  const div = document.createElement('div');
  div.className = 'q';
  const number = document.createElement('span');
  number.className = 'num';
  number.textContent = (index + 1) + '.';
  const equation = document.createElement('span');
  equation.className = 'equation';
  const blank = item.expression.includes('□');
  equation.append(math(item.expression, blank && answers ? item.answer : undefined));
  if (!blank) {
    equation.append(' = ');
    if (answers) equation.append(blankAnswer(item.answer));
  }
  div.append(number, equation);
  return div;
}
function render() {
  const big = size === 'B4';
  const cols = big ? 4 : 2;
  const rows = Math.ceil(items.length / cols);
  const width = big ? 237 : 190;
  const font = Math.min(big ? 3.1 : 5.4, (big ? 65 : 89) / rows);
  const sheet = el('sheet');
  const vars = {'--w':width+'mm','--h':(big?344:277)+'mm','--ratio':big?'257/364':'210/297',
    '--base':width*.0225+'mm','--cols':cols,'--rows':rows,'--font':font+'cqw','--pf':width*font/100+'mm'};
  for (const [name, value] of Object.entries(vars)) sheet.style.setProperty(name, value);
  el('page').textContent = '@page{size:'+(big?'257mm 364mm':'210mm 297mm')+';margin:10mm}';
  el('title').textContent = (selectedStages.every(stage => stage.topic === selectedStages[0].topic) ? selectedStages[0].topic : 'けいさん') + (answers?' の こたえ':' の れんしゅう');
  el('subtitle').textContent = selectedStages.length <= 2 ? selectedStages.map(stage => stage.label).join('・') : selectedStages.length + 'つの だんかいを まぜた れんしゅう';
  el('total').textContent = items.length;
  el('qs').replaceChildren(...items.map(row));
  fitRows();
  el('print-answers').checked = answers;
  el('answer-colors').hidden = !answers;
  el('answer-colors').disabled = !answers;
}
// Apply a common scale to keep long expressions and handwriting space within the column.
function fitRows() {
  const cells = [...el('qs').children];
  for (const cell of cells) cell.style.fontSize = '';
  let scale = 1;
  for (const cell of cells) {
    const font = parseFloat(getComputedStyle(cell).fontSize);
    const parts = [...cell.children].map(child=>child.getBoundingClientRect());
    const reserve = answers || cell.children[1].textContent.includes('□') ? 0 : 1.5 * font;
    const needed = parts[0].width + parts[1].width + .3 * font + reserve;
    if (cell.clientWidth) scale = Math.min(scale, cell.clientWidth / needed, cell.clientHeight / Math.max(1,parts[1].height));
  }
  for (const cell of cells) cell.style.fontSize = (scale*99)+'%';
}
function resize() {
  const input = el('n');
  const count = Math.min(Number(input.max), Math.max(1, Math.floor(Number(input.value) || 1)));
  input.value = count;
  if (count < items.length) upcoming.push(...items.splice(count).reverse());
  while (items.length < count) items.push(nextProblem());
  render();
}
function paper(i) {
  size = i ? 'B4' : 'A4';
  el('n').max = i ? 100 : 50;
  el('limit').textContent = el('n').max+'問まで';
  resize();
}
function shuffle() {
  items = [];
  stageDecks.clear();
  stageRound = [];
  upcoming.length = 0;
  resize();
}
// Bright filter-matched colors reduce contrast through the corresponding study sheet.
const inks = ['#111111','#66dd66','#ff7777'];
buttons('sizes',['A4','B4'],paper);
buttons('colors',['黒','緑','赤'],i => el('sheet').style.setProperty('--answer',inks[i]),inks);
selectOptions('grade',range(1,6).map(n => n+'年生'));
el('grade').onchange = selectGrade;

el('n').oninput = () => {if(el('n').value) resize()};
el('n').onblur = resize;
el('shuffle').onclick = shuffle;
el('print-answers').onchange = () => {
  answers = el('print-answers').checked;
  render();
};
el('print').onclick = () => { resize(); window.print(); };
window.addEventListener('resize',fitRows);
window.addEventListener('beforeprint',fitRows);
window.addEventListener('afterprint',fitRows);
el('n').max = 50;
selectGrade();
paper(0);




