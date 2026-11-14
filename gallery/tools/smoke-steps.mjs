export default async (pg) => {
  const k = await pg.$("#k"); const r = await k.boundingBox();
  const cx = r.x + r.width/2, cy = r.y + r.height/2;
  await pg.mouse.move(cx, cy - 50); await pg.mouse.down();
  for (let i=0;i<=10;i++){ const a=-Math.PI/2 + i*0.08; await pg.mouse.move(cx+50*Math.cos(a), cy+50*Math.sin(a)); }
  await pg.mouse.up(); await pg.waitForTimeout(400);
  console.log("knob after cw drag:", await pg.evaluate(()=>[k.value, document.getElementById('k').style.getPropertyValue('--tr-angle')]));
  await pg.focus("#k"); await pg.keyboard.press("Home"); console.log("knob Home:", await pg.evaluate(()=>k.value));
  const s = await (await pg.$("#s")).boundingBox(); await pg.mouse.click(s.x + s.width*0.75, s.y+10); await pg.waitForTimeout(300);
  console.log("slider click 75%:", await pg.evaluate(()=>s.value));
  await pg.click("#b"); await pg.waitForTimeout(300); console.log("latch:", await pg.getAttribute("#b","aria-pressed"));
  await pg.click("#t"); await pg.waitForTimeout(300); console.log("toggle:", await pg.getAttribute("#t","aria-checked"));
  const t = await (await pg.$("#t")).boundingBox(); await pg.mouse.move(t.x+20,t.y+40); await pg.mouse.down(); await pg.mouse.move(t.x+20,t.y+90,{steps:5}); await pg.mouse.up(); await pg.waitForTimeout(300);
  console.log("toggle drag down:", await pg.getAttribute("#t","aria-checked"));
};
