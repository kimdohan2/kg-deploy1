// 허브집사가 쓰는 도구 3개 (MCP 서버, Hermes가 stdio로 실행한다).
// 모두 읽기 전용이다. 실제 읽기와 찾기는 apphub.js가 한다.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { findLinks, listProjects, who } from './apphub.js';

const server = new McpServer({ name: 'apphub', version: '1.0.0' });
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

const reply = fn => async args => {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await fn(args)) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: err.message }] };
  }
};

server.registerTool('list_projects', {
  title: '프로젝트 목록',
  description: '앱허브의 모든 프로젝트(이름, 상태, 담당자, 빈 링크 개수)와 항목 이름 목록. '
    + '사용자가 부른 프로젝트 이름이 정확하지 않을 때(영어 이름, 줄임말) 먼저 이걸로 진짜 이름을 확인한다.',
  inputSchema: { status: z.string().optional().describe('상태로 거르기: 기획중, 개발중, 라이브, 종료') },
  annotations: readOnly,
}, reply(listProjects));

server.registerTool('find_links', {
  title: '링크 찾기',
  description: '프로젝트의 링크를 찾는다. item을 비우면 그 프로젝트의 모든 링크. '
    + 'project를 비우고 item만 주면 모든 프로젝트의 그 항목을 한 번에 돌려준다(allProjects). '
    + '"각 프로젝트 기획서"처럼 여러 프로젝트를 물으면 프로젝트마다 따로 부르지 말고 이렇게 한 번만 부른다. '
    + 'url이 null이면 앱허브에 아직 링크가 등록되지 않은 칸이다.',
  inputSchema: {
    project: z.string().optional().describe('프로젝트 이름. 예: 코코비 치과의사, 치과, 공룡월드'),
    item: z.string().optional().describe('항목 이름. 예: 애드몹, 구글플레이콘솔, 앱스토어커넥트, 기획서, QA시트'),
  },
  annotations: readOnly,
}, reply(findLinks));

server.registerTool('who', {
  title: '담당자 찾기',
  description: 'person을 주면 그 사람이 맡은 프로젝트(상태, 빈 링크 항목)를, project를 주면 그 프로젝트의 담당자와 역할을 알려 준다. '
    + '둘 다 비우면 담당자 전체 목록.',
  inputSchema: {
    project: z.string().optional().describe('프로젝트 이름'),
    person: z.string().optional().describe('앱허브에 등록된 담당자 이름. 예: 김도한'),
  },
  annotations: readOnly,
}, reply(who));

await server.connect(new StdioServerTransport());
