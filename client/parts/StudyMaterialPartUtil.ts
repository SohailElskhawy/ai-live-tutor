import { StudyMaterialPart } from '../../shared/schema/PromptPartDefinitions'
import { $studyContext, getStudyExcerpt } from '../study/studyStore'
import { PromptPartUtil, registerPromptPartUtil } from './PromptPartUtil'

/**
 * Gives the drawing agent the student's uploaded study material,
 * so diagrams use the same terms and facts as the PDF.
 */
export const StudyMaterialPartUtil = registerPromptPartUtil(
	class StudyMaterialPartUtil extends PromptPartUtil<StudyMaterialPart> {
		static override type = 'studyMaterial' as const

		override getPart(): StudyMaterialPart {
			return {
				type: 'studyMaterial',
				title: $studyContext.get()?.title ?? null,
				excerpt: getStudyExcerpt(8000),
			}
		}
	}
)
