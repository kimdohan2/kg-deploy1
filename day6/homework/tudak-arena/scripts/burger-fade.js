// Show me the burger 곡 끝이 툭 끊기지 않게: 마지막 1초 동안 소리를 조금 줄이고, 끝난 자리에 잔향 꼬리(약 2초)를 붙여 서서히 사라지게 한다.
//   가사는 곡 끝까지 이어지므로 곡 자체를 0까지 줄이지 않는다 (마지막 가사가 안 들리면 안 됨).
//   한 번 처리한 곡은 public/burger/songs/faded.json에 기록해 두고 다시 처리하지 않는다 (곡을 새로 만들면 다시 처리).
//   npm run burger-fade [곡 id...]   (ffmpeg 필요, 크레딧 안 듦)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const dir = `${root}/public/burger/songs`;
const logPath = `${dir}/faded.json`;
const DIP = 1.0;      // 끝나기 전 이만큼(초) 동안 소리를 줄임
const LEVEL = 0.4;    // 곡 마지막 순간 소리 크기 (원래 1)
const TAIL = 1.8;     // 붙이는 잔향 꼬리 길이(초)
// 잔향: 간격이 제각각인 메아리 12겹 (ms, 크기) → 하나로 뭉개져 '웅~' 하고 사라지는 소리
const ECHO_MS = '97|163|241|331|433|547|673|811|961|1123|1297|1483';
const ECHO_GAIN = '0.62|0.56|0.5|0.44|0.39|0.34|0.29|0.25|0.21|0.17|0.14|0.11';

const md5 = f => createHash('md5').update(readFileSync(f)).digest('hex');
const duration = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

export function fadeSong(id) {
  const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : {};
  const file = `${dir}/${id}.mp3`;
  if (log[id] && log[id] === md5(file)) return false;   // 이미 처리함
  const d = duration(file);
  const from = (d - DIP).toFixed(3);
  // 꼬리: 곡 마지막 1.2초에 메아리를 겹쳐 울리고, 원래 곡이 끝난 뒤에 남는 울림만 잘라 붙인다
  const graph = [
    `[0:a]asplit=2[a][b]`,
    `[a]volume='if(gte(t,${from}),1-${1 - LEVEL}*(t-${from})/${DIP},1)':eval=frame[dry]`,
    `[b]atrim=start=${(d - 1.2).toFixed(3)},asetpts=PTS-STARTPTS,volume=${LEVEL},apad=pad_dur=${TAIL}[src]`,
    `[src]aecho=1:0.35:${ECHO_MS}:${ECHO_GAIN},atrim=start=1.2:duration=${TAIL},asetpts=PTS-STARTPTS,afade=t=out:curve=qsin:d=${TAIL}[tail]`,
    `[dry][tail]concat=n=2:v=0:a=1,alimiter=limit=0.97[out]`,
  ].join(';');
  const tmp = `${file}.fade.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-filter_complex', graph, '-map', '[out]', '-ar', '44100', '-b:a', '192k', tmp]);
  renameSync(tmp, file);
  log[id] = md5(file);
  writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2);
  const ids = only.length ? only : readdirSync(dir).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4)).sort();
  let n = 0;
  for (const id of ids) {
    if (fadeSong(id)) { n++; console.log(`✓ ${id}`); } else console.log(`- ${id} 이미 처리함`);
  }
  console.log(`끝부분 처리: ${n}곡`);
}
