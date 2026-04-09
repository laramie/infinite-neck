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
    let svgElem = node('svg', { width: 20, height: 20 });
    svgElem.appendChild(
      node('path', { d: text, transform: 'scale(0.5  0.5)  translate(0  15)', fill: 'darkred' })
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

//OEM version worked with the svg element outside of em.
// Exported: toggle (toggles display of JSON tree branches)

// Recursively update all triangles under a parent div
function updateTrianglesRecursive(parentDiv) {
  // For each em with a child svg (triangle) in this subtree
  parentDiv.querySelectorAll('em').forEach(em => {
    const svgPath = em.querySelector('svg path');
    const nextDiv = em.nextSibling;
    if (svgPath && nextDiv && nextDiv.tagName === 'DIV') {
      // If the div is visible, triangle should be down; else right
      const isOpen = nextDiv.style.display === 'block';
      svgPath.setAttribute('d', isOpen ? path.hide : path.show);
      // Recurse into children
      updateTrianglesRecursive(nextDiv);
    }
  });
}

export function toggle(element) {
  // Determine if currently open
  const isOpen = element.nextSibling.style.display === 'block';
  // Toggle open/close
  element.nextSibling.style.display = isOpen ? 'none' : 'block';
  // Set triangle direction: down if open, right if closed
  element.querySelectorAll('svg path').forEach(arrow => {
    arrow.setAttribute('d', isOpen ? path.show : path.hide);
  });
  // Show/hide children divs
  element.nextSibling.querySelectorAll('div').forEach(el => {
    el.style.display = isOpen ? 'none' : 'block';
  });
  // Recursively update all triangles in the subtree
  updateTrianglesRecursive(element.nextSibling);
}


export function jsonTree(tree, parent) {
  Object.entries(tree).forEach(([key, value]) => {
    let node = add('span', parent);
    if (typeof value !== 'object' || value === null) {
      node.append(svg(''));
      add('em', node, key + ':');
      let label = add('em', node);
      label.dataset.type = typeof value;
      value === null ? add('b', label, 'NULL') : add('em', label, value);
      add('em', label, typeof value).style.color = '#c1e1e1';
    } else {
      // Create the clickable em element
      let trigger = add('em', node);
      trigger.style.cursor = 'pointer';
      // Append the SVG inside the em
      trigger.appendChild(svg(path.show));
      trigger.appendChild(document.createTextNode(key + ':  {  '));
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
