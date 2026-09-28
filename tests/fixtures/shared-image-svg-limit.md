# 합성 SVG 한도 경계 문서

고객 문서가 아닌 기존 viewer-two-pages.hwpx의 구조와 seed 28 난수 RGB 그림으로 생성했다. 하나의 600×600 PNG를 80페이지에 공유한다. 약 1 MiB 입력이 72페이지의 누적 SVG에서 100 MiB를 넘는 앱 경계를 검사하며 한컴 출력과의 시각 일치를 주장하지 않는다.

재생성: 저장소 루트에 diagnostics/를 만들고 generate-shared-image-limit.py를 실행하면 합성 HWPX 2/80페이지가 생성된다. @rhwp/core 0.8.6의 HwpDocument로 shared-image-80.hwpx를 열고 exportHwp() 결과를 이 fixture로 저장한다. 생성 결과는 다시 열어 80페이지인지 확인한다. SVG byte 수는 렌더러 버전에 종속되므로 엔진 갱신 때 경계를 재확인한다.
