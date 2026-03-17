// Original source: https://www.anowave.com/quicks/visualize-json-with-vanilla-javascript
// Refactored from json-tree-raw.js to ES module with named exports


// Utility: isNumeric
const isNumeric = (num) => (typeof(num) === 'number' || typeof(num) === 'string' && num.trim() !== '') && !isNaN(num);

// SVG path data
const path = {
  show: 'M3  24l18-12-18-12v24zm16.197-12l-15.197  10.132v-20.263l15.197  10.131',
  hide: 'M0  3l12  18  12-18h-24zm12  16.197l-10.132-15.197h20.263l-10.131  15.197'
};

// SVG creation helper
function createSVGNode(n, v) {
  n = document.createElementNS("http://www.w3.org/2000/svg", n);
  for (var p in v) {
    n.setAttributeNS(null, p, v[p]);
  }
  return n;
}

// Exported: svg (returns a function that creates SVG elements for arrows)
export const svg = (function(node) {
  return function(text) {
    let svgElem = node('svg', { width: 12, height: 12 });
    svgElem.appendChild(
      node('path', { d: text, transform: 'scale(0.3  0.3)  translate(0  15)' })
    );
    return svgElem;
  };
})(createSVGNode);

// Exported: add (adds an element to the DOM, sets content)
export function add(element, parent, content) {
  let e = document.createElement(element);
  (typeof parent !== 'undefined' ? parent : document.body).appendChild(e);
  if (typeof content !== 'undefined') {
    e.innerHTML = content.toString().length ? content : '&lt;empty  string&gt;';
  }
  return e;
}

// Exported: toggle (toggles display of JSON tree branches)
export function toggle(element) {
  let display = element.nextSibling.style.display.indexOf('block') ? false : true;
  element.nextSibling.style.display = display ? 'none' : 'block';
  element.previousSibling.parentNode.querySelectorAll('svg path').forEach(arrow => {
    arrow.setAttribute('d', arrow.getAttribute('d') ? (display ? path.show : path.hide) : '');
  });
  element.nextSibling.querySelectorAll('div').forEach(el => {
    el.style.display = display ? 'none' : 'block';
  });
}

// Exported: json (renders a JSON object as a tree in the DOM)
export function jsonTree(tree, parent) {
  Object.entries(tree).forEach(([key, value]) => {
    let node = add('span', parent);
    if (typeof value !== 'object' || value === null) {
      node.append(svg(''));
      add('em', node, key + ':');
      let label = add('em', node);
      label.dataset.type = typeof value;
      value === null ? add('b', label, 'NULL') : add('em', label, value);
      add('em', label, typeof value).style.color = 'rgba(220,220,220,1)';
    } else {
      node.append(svg(path.show));
      let trigger = add('em', node, key + ':  {  ');
      trigger.style.cursor = 'pointer';
      trigger.addEventListener('click', event => {
        toggle(event.currentTarget);
      });
      let wrapper = add('div', node);
      wrapper.style.display = 'none';
      jsonTree(value, wrapper);
      add('em', node, '}').style.marginLeft = '11px';
    }
  });
}
