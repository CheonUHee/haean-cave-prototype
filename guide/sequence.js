// 데모 입력 타임라인 시퀀서 — DOM 없는 순수 로직.
// events: [{ t, …payload }] (t 오름차순, 초). duration 도달 시 처음부터 루프.
export function makeSequencer(events, duration) {
  let i = 0, time = 0;
  return {
    get time() { return time; },
    advance(dt) {
      time += dt;
      const fired = [];
      while (i < events.length && events[i].t <= time) fired.push(events[i++]);
      let looped = false;
      if (time >= duration) { time = 0; i = 0; looped = true; }
      return { fired, looped };
    },
  };
}
