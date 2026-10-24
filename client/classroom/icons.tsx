import { SVGProps } from 'react'

// Lucide-style 24px stroke icons, inlined so the app needs no icon package.
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			{children}
		</svg>
	)
}

export const MicIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
		<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
		<line x1="12" x2="12" y1="19" y2="22" />
	</Icon>
)

export const MicOffIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<line x1="2" x2="22" y1="2" y2="22" />
		<path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
		<path d="M5 10v2a7 7 0 0 0 12 5" />
		<path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
		<path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
		<line x1="12" x2="12" y1="19" y2="22" />
	</Icon>
)

export const PhoneOffIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
		<line x1="22" x2="2" y1="2" y2="22" />
	</Icon>
)

export const KeyIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<circle cx="7.5" cy="15.5" r="5.5" />
		<path d="m21 2-9.6 9.6" />
		<path d="m15.5 7.5 3 3L22 7l-3-3" />
	</Icon>
)

export const FileTextIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
		<path d="M14 2v4a2 2 0 0 0 2 2h4" />
		<path d="M10 9H8" />
		<path d="M16 13H8" />
		<path d="M16 17H8" />
	</Icon>
)

export const UploadIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<polyline points="17 8 12 3 7 8" />
		<line x1="12" x2="12" y1="3" y2="15" />
	</Icon>
)

export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5Z" />
		<path d="m15 5 4 4" />
	</Icon>
)

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M20 6 9 17l-5-5" />
	</Icon>
)

export const XIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	</Icon>
)

export const ChevronLeftIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="m15 18-6-6 6-6" />
	</Icon>
)

export const ChevronRightIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="m9 18 6-6-6-6" />
	</Icon>
)

export const RotateIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
		<path d="M3 3v5h5" />
	</Icon>
)

export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.03.94l7.93 3.18a2 2 0 0 1 1.11 1.11Z" />
		<path d="m21.85 2.15-10.94 10.94" />
	</Icon>
)

export const SparklesIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0Z" />
	</Icon>
)

export const GraduationCapIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z" />
		<path d="M22 10v6" />
		<path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
	</Icon>
)

export const ShieldIcon = (p: SVGProps<SVGSVGElement>) => (
	<Icon {...p}>
		<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
	</Icon>
)
