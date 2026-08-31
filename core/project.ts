export const PROJECT_NAME = 'SuiFill';

export const MILESTONES = [
  '工程初始化',
  '本地加密信息库',
  '个人信息管理',
  '场景预设',
  '表单识别',
  '预览与填充',
  '网站自定义规则',
  '安全与备份',
  '发布候选版',
] as const;

export const CURRENT_MILESTONE_INDEX = 8;

export function getProjectProgress(completedMilestones: number): number {
  const safeCompleted = Math.min(Math.max(completedMilestones, 0), MILESTONES.length);
  return Math.round((safeCompleted / MILESTONES.length) * 100);
}
