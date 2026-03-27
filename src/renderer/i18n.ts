import { create } from 'zustand'

export type Locale = 'ko' | 'en'

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'en',
  setLocale: (locale) => set({ locale }),
}))

/** Read locale outside React (e.g. from Phaser) */
export function getLocale(): Locale {
  return useLocaleStore.getState().locale
}

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const ko = {
  // App
  'app.title': 'Agent Office',
  'app.settings': '설정',
  'app.waiting': '대기 중 — 업무를 지시해주세요',

  // Tabs
  'tab.command': 'Command Center',
  'tab.artifacts': '산출물',

  // Roles
  'role.ceo': '사장',
  'role.teamlead': '팀장',
  'role.senior': '선임',
  'role.junior': '사원',
  'role.system': '시스템',
  'role.alpha-lead': '팀장',
  'role.alpha-senior': '선임',
  'role.alpha-worker1': '사원1',
  'role.alpha-worker2': '사원2',
  'role.beta-lead': '팀장',
  'role.beta-senior': '선임',
  'role.beta-worker1': '사원1',
  'role.beta-worker2': '사원2',

  // Teams
  'team.alpha': 'Alpha 팀',
  'team.beta': 'Beta 팀',
  'team.enabled': '활성',
  'team.disabled': '비활성',

  // Status
  'status.idle': '대기',
  'status.thinking': '분석중',
  'status.working': '작업중',
  'status.talking': '보고중',
  'status.done': '완료',
  'status.error': '오류',

  // Workflow
  'workflow.title': 'Workflow',
  'workflow.planning': '기획',
  'workflow.researching': '조사',
  'workflow.implementing': '구현',
  'workflow.reviewing': '검토',
  'workflow.complete': '완료',
  'workflow.revision': '수정 {n}/3',
  'workflow.teams-working': '팀 작업 중',
  'workflow.ceo-comparing': '결과 비교',

  // Chat
  'chat.placeholder': '업무를 지시하세요...',
  'chat.processing': '처리 중...',
  'chat.submit': '지시',
  'chat.agentsWorking': '에이전트가 작업 중입니다',
  'chat.reviewDone': '검토가 완료되었습니다. 결과를 확인해주세요.',
  'chat.approve': '승인',
  'chat.cancel': '취소',
  'chat.taskReceived': '태스크 접수 완료 (ID: {id}). 팀들에게 전달합니다...',
  'chat.approved': '승인 처리되었습니다.',
  'chat.cancelled': '취소 처리되었습니다.',
  'chat.error': '오류: {msg}',
  'chat.welcome': 'Agent Office가 준비되었습니다. 사장님, 업무를 지시해주세요.',

  // Agents panel
  'agents.title': 'Agents',

  // Files
  'files.title': 'Files',
  'files.empty': '파일 없음',
  'files.noTask': '태스크를 시작하면 산출물이 여기에 표시됩니다',
  'files.loading': '로딩 중...',
  'files.selectFile': '파일을 선택하세요',

  // Settings
  'settings.title': '에이전트 설정',
  'settings.description': '각 에이전트의 프로바이더와 실행 환경을 설정합니다',
  'settings.provider': 'Agent Provider',
  'settings.target': '실행 위치',
  'settings.local': '로컬',
  'settings.remote': '원격 서버',
  'settings.save': '저장',
  'settings.cancel': '취소',
  'settings.language': '언어',
  'settings.languageDesc': '시스템 표시 언어',
  'settings.system': '시스템 설정',
  'settings.remoteWorkspace': '원격 Workspace 경로',

  // Game labels
  'game.meetingRoom': '회의실',
  'game.coffee': '커피',
  'game.ceo': '사장 (나)',
} as const

const en: Record<keyof typeof ko, string> = {
  'app.title': 'Agent Office',
  'app.settings': 'Settings',
  'app.waiting': 'Waiting — assign a task to begin',

  'tab.command': 'Command Center',
  'tab.artifacts': 'Artifacts',

  'role.ceo': 'CEO',
  'role.teamlead': 'Team Lead',
  'role.senior': 'Senior',
  'role.junior': 'Junior',
  'role.system': 'System',
  'role.alpha-lead': 'Lead',
  'role.alpha-senior': 'Senior',
  'role.alpha-worker1': 'Staff 1',
  'role.alpha-worker2': 'Staff 2',
  'role.beta-lead': 'Lead',
  'role.beta-senior': 'Senior',
  'role.beta-worker1': 'Staff 1',
  'role.beta-worker2': 'Staff 2',

  'team.alpha': 'Team Alpha',
  'team.beta': 'Team Beta',
  'team.enabled': 'Enabled',
  'team.disabled': 'Disabled',

  'status.idle': 'Idle',
  'status.thinking': 'Analyzing',
  'status.working': 'Working',
  'status.talking': 'Reporting',
  'status.done': 'Done',
  'status.error': 'Error',

  'workflow.title': 'Workflow',
  'workflow.planning': 'Plan',
  'workflow.researching': 'Research',
  'workflow.implementing': 'Implement',
  'workflow.reviewing': 'Review',
  'workflow.complete': 'Done',
  'workflow.revision': 'Revision {n}/3',
  'workflow.teams-working': 'Teams Working',
  'workflow.ceo-comparing': 'Comparing Results',

  'chat.placeholder': 'Assign a task...',
  'chat.processing': 'Processing...',
  'chat.submit': 'Send',
  'chat.agentsWorking': 'Agents are working',
  'chat.reviewDone': 'Review complete. Please check the results.',
  'chat.approve': 'Approve',
  'chat.cancel': 'Cancel',
  'chat.taskReceived': 'Task received (ID: {id}). Dispatching to teams...',
  'chat.approved': 'Approved successfully.',
  'chat.cancelled': 'Cancelled successfully.',
  'chat.error': 'Error: {msg}',
  'chat.welcome': 'Agent Office is ready. Please assign a task.',

  'agents.title': 'Agents',

  'files.title': 'Files',
  'files.empty': 'No files',
  'files.noTask': 'Artifacts will appear here once a task starts',
  'files.loading': 'Loading...',
  'files.selectFile': 'Select a file',

  'settings.title': 'Agent Settings',
  'settings.description': 'Configure provider and execution target for each agent',
  'settings.provider': 'Agent Provider',
  'settings.target': 'Execution Target',
  'settings.local': 'Local',
  'settings.remote': 'Remote Server',
  'settings.save': 'Save',
  'settings.cancel': 'Cancel',
  'settings.language': 'Language',
  'settings.languageDesc': 'System display language',
  'settings.system': 'System',
  'settings.remoteWorkspace': 'Remote Workspace Path',

  'game.meetingRoom': 'Meeting Room',
  'game.coffee': 'Coffee',
  'game.ceo': 'CEO (You)',
}

type TranslationKey = keyof typeof ko

const messages: Record<Locale, Record<TranslationKey, string>> = { ko, en }

/**
 * Get a translated string. Supports simple {key} interpolation.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const locale = useLocaleStore.getState().locale
  let text = messages[locale]?.[key] || messages['en'][key] || key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}

/**
 * React hook version — re-renders on locale change.
 */
export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = messages[locale]?.[key] || messages['en'][key] || key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}
