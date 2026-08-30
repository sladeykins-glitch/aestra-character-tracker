// Floralist Growth Clock spacing fix — keep the four petals distinct around the core.
(function(){
 const style=document.createElement('style');
 style.id='floralistPetalSpacingFix';
 style.textContent=`
 .fl-flower{width:min(420px,82vw)!important;aspect-ratio:1!important}
 .fl-flower .petal{width:36%!important;height:36%!important;border-radius:58% 58% 45% 45%!important;z-index:1}
 .fl-flower .p1{left:32%!important;top:0!important}
 .fl-flower .p2{right:0!important;top:32%!important}
 .fl-flower .p3{left:32%!important;bottom:0!important}
 .fl-flower .p4{left:0!important;top:32%!important}
 .fl-core{width:22%!important;z-index:3}
 @media(max-width:720px){
   .fl-flower{width:min(350px,90vw)!important}
   .fl-flower .petal{width:34%!important;height:34%!important}
   .fl-flower .p1{left:33%!important;top:1%!important}
   .fl-flower .p2{right:1%!important;top:33%!important}
   .fl-flower .p3{left:33%!important;bottom:1%!important}
   .fl-flower .p4{left:1%!important;top:33%!important}
   .fl-core{width:21%!important}
 }
 `;
 document.head.appendChild(style);
})();