export function pageIndex(value: string | number, count: number): number {
  if ((typeof value === 'string' && !/^\d+$/.test(value)) || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > count) {
    throw new RangeError(`페이지는 1~${count} 사이의 정수로 입력하세요.`);
  }
  return Number(value) - 1;
}
export function zoomValue(value: number): number {
  if (!Number.isFinite(value) || value < 50 || value > 200) throw new RangeError('확대 배율은 50~200%로 선택하세요.');
  return value;
}
