(()  =>  
{
        const  isNumeric  =  (num)  =>  (typeof(num)  ===  'number'  ||  typeof(num)  ===  "string"  &&  num.trim()  !==  '')  &&  !isNaN(num);
        const  path  =  
        {
                show:  'M3  24l18-12-18-12v24zm16.197-12l-15.197  10.132v-20.263l15.197  10.131',
                hide:  'M0  3l12  18  12-18h-24zm12  16.197l-10.132-15.197h20.263l-10.131  15.197'
        }
        let  svg  =  (node  =>  
        {
                return  (text  =>  
                {
                        let  svg  =  node('svg',  {  width:12,  height:  12  });
                        svg.appendChild
                        (
                                node('path',  {  d:  text,  transform:'scale(0.3  0.3)  translate(0  15)'  })
                        );
                        return  svg;
                });
        
        })((n,  v)  =>  
        {
                        n  =  document.createElementNS("http://www.w3.org/2000/svg",  n);
                        
                        for  (var  p  in  v)  
                        {
                                n.setAttributeNS(null,  p,  v[p]);
                        }
                        
                        return  n;
        });
        let  add  =  (element,  parent,  content)  =>  
        {
                let  e  =  document.createElement(element);
                ('undefined'  !==  typeof  parent  ?  parent  :  document.body).appendChild(e);
                if  ('undefined'  !==  typeof  content)
                {
                        e.innerHTML  =  content.toString().length    ?  content  :  '&lt;empty  string&gt;'
                }
                return  e;
        };
        let  toggle  =  element  =>  
        {
                let  display  =  element.nextSibling.style.display.indexOf('block')  ?  false  :  true;
                element.nextSibling.style.display  =  display  ?  'none'  :  'block';
                element.previousSibling.parentNode.querySelectorAll('svg  path').forEach(arrow  =>  
                {
                        arrow.setAttribute('d',  arrow.getAttribute('d')  ?  (display  ?  path.show  :  path.hide)  :  '');
                });
                element.nextSibling.querySelectorAll('div').forEach(element  =>  
                {
                        element.style.display  =  display  ?  'none'  :  'block';
                });
        };
        let  json  =  (tree,  parent)  =>  
        {
                Object.entries(tree).forEach(([key,  value])=>  
                {
                        let  node  =  add('span',  parent);
                        if  ('object'  !==  typeof  value  ||  null  ===  value)
                        {
                                node.append(svg(''));
                                add('em',  node,  key  +  ':')
                                let  label  =  add('em',  node);
                                label.dataset.type  =  typeof  value;
                                null  ===  value  ?  add('b',  label,  'NULL')  :  add('em',  label,  value);
                                add('em',  label,  typeof  value).style.color  =  'rgba(220,220,220,1)';
                        }
                        else  
                        {
                                node.append(svg(path.show));
                                let  trigger  =  add('em',  node,  key  +  ':  {  ');
                                trigger.style.cursor  =  'pointer';
                                trigger.addEventListener('click',  event  =>  
                                {
                                        toggle(event.currentTarget);  
                                });
                                let  wrapper  =  add('div',  node);
                                wrapper.style.display  =  'none';
                                json(value,  wrapper);
                                add('em',node,'}').style.marginLeft  =  '11px';
                        }
                });
        };
        
        document.querySelectorAll('[data-json]').forEach(wrapper  =>  
        {
                json(JSON.parse(wrapper.dataset.json),  wrapper);
        });
})();