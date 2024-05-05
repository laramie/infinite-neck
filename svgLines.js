function drawLine(){
    var b1 = document.getElementById('btn1').getBoundingClientRect();
    var b2 = document.getElementById('btn2').getBoundingClientRect();
    var newLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    newLine.setAttribute('id', 'line1');
    newLine.setAttribute('x1', b1.left + b1.width / 2);
    newLine.setAttribute('y1', b1.top + b1.height / 2);
    newLine.setAttribute('x2', b2.left + b2.width / 2);
    newLine.setAttribute('y2', b2.top + b2.height / 2);
    newLine.setAttribute('style', 'stroke: black; stroke-width: 2;');
    document.getElementById("fullsvg").append(newLine);
}
