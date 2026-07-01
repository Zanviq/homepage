import type { Lang } from "./types";

type Dict = Record<string, { ko: string; en: string }>;

export const STRINGS: Dict = {
  nav_work: { ko: "작업", en: "Work" },
  nav_about: { ko: "소개", en: "About" },
  selected_work: { ko: "선정 작업", en: "Selected Work" },
  about_me: { ko: "소개", en: "About" },
  view_project: { ko: "프로젝트 보기", en: "View project" },
  back_home: { ko: "홈으로", en: "Back home" },
  all_projects: { ko: "전체 프로젝트", en: "All projects" },
  no_projects: { ko: "아직 등록된 프로젝트가 없습니다.", en: "No projects yet." },
  links: { ko: "링크", en: "Links" },
  tags: { ko: "태그", en: "Tags" },
  updated: { ko: "업데이트", en: "Updated" },
  // admin
  login_title: { ko: "관리자 로그인", en: "Admin login" },
  username: { ko: "아이디", en: "Username" },
  password: { ko: "비밀번호", en: "Password" },
  sign_in: { ko: "로그인", en: "Sign in" },
  dashboard: { ko: "대시보드", en: "Dashboard" },
  new_project: { ko: "새 프로젝트", en: "New project" },
  edit_profile: { ko: "프로필 편집", en: "Edit profile" },
  logout: { ko: "로그아웃", en: "Log out" },
  save: { ko: "저장", en: "Save" },
  delete: { ko: "삭제", en: "Delete" },
  cancel: { ko: "취소", en: "Cancel" },
  preview: { ko: "미리보기", en: "Preview" },
  write: { ko: "작성", en: "Write" },
  published: { ko: "게시됨", en: "Published" },
  draft: { ko: "비공개", en: "Draft" },
};

export function t(key: keyof typeof STRINGS | string, lang: Lang): string {
  const entry = STRINGS[key];
  return entry ? entry[lang] : String(key);
}
