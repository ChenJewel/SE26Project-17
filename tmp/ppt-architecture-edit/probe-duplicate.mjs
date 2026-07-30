import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const source = "D:/U eat/tmp/ppt-architecture-edit/source.pptx";
const presentation = await PresentationFile.importPptx(await FileBlob.load(source));
const sourceSlide = presentation.slides.getItem(11);
const duplicate = sourceSlide.duplicate();
duplicate.moveTo(12);
const inspect = await presentation.inspect({ kind: "slide", maxChars: 8000 });
console.log(inspect.ndjson);
