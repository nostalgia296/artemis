export interface NavItem {
	text: string;
	link: string;
}

export interface SidebarItem {
	text: string;
	link?: string;
	items?: SidebarItem[];
}

export interface SocialLink {
	icon: 'github' | 'twitter' | 'discord';
	link: string;
}

export interface LocaleConfig {
	title: string;
	description: string;
	nav: NavItem[];
	sidebar: SidebarItem[];
	ui: {
		search: string;
		previous: string;
		next: string;
		onThisPage: string;
		getStarted: string;
		viewOnGithub: string;
		whatsNew: string;
		justShipped: string;
		tocComingSoon: string;
		searchPlaceholder: string;
		searchNoResults: string;
		searchCancel: string;
		menu?: string;
	};
}

export interface DocsConfig {
	defaultLocale: string;
	socialLinks: SocialLink[];
	locales: Record<string, LocaleConfig>;
}

export const config: DocsConfig = {
	defaultLocale: 'en',
	socialLinks: [{ icon: 'github', link: 'https://github.com/nostalgia296/artemis' }],
	locales: {
		en: {
			title: 'Artemis',
			description: 'Cross-platform PFS archive tool.',
			ui: {
				search: 'Search',
				previous: 'Previous',
				next: 'Next',
				onThisPage: 'On this page',
				getStarted: 'Get started',
				viewOnGithub: 'View on GitHub',
				whatsNew: "What's new",
				justShipped: 'Just shipped v1.0',
				tocComingSoon: 'TOC coming soon',
				searchPlaceholder: 'Search...',
				searchNoResults: 'No results found',
				searchCancel: 'Cancel',
				menu: 'Menu'
			},
			nav: [
				{ text: 'Documentation', link: '/docs/getting-started' }
			],
			sidebar: [
				{
					text: 'Getting Started',
					items: [
						{ text: 'Introduction', link: '/docs/getting-started' },
						{ text: 'Installation', link: '/docs/installation' }
					]
				},
				{
					text: 'Components',
					items: [
						{ text: 'CLI', link: '/docs/cli' },
						{ text: 'Web (WASM)', link: '/docs/web' },
						{ text: 'Android App', link: '/docs/android' }
					]
				}
			]
		},
		zh: {
			title: 'Artemis',
			description: '跨平台 PFS 归档工具。',
			ui: {
				search: '搜索',
				previous: '上一页',
				next: '下一页',
				onThisPage: '本页目录',
				getStarted: '开始使用',
				viewOnGithub: '在 GitHub 上查看',
				whatsNew: '最新动态',
				justShipped: 'v1.0 现已发布',
				tocComingSoon: '目录即将推出',
				searchPlaceholder: '搜索文档...',
				searchNoResults: '未找到结果',
				searchCancel: '取消',
				menu: '菜单'
			},
			nav: [
				{ text: '文档', link: '/zh/docs/getting-started' }
			],
			sidebar: [
				{
					text: '起步',
					items: [
						{ text: '简介', link: '/zh/docs/getting-started' },
						{ text: '安装', link: '/zh/docs/installation' }
					]
				},
				{
					text: '核心组件',
					items: [
						{ text: '命令行 (CLI)', link: '/zh/docs/cli' },
						{ text: 'Web 客户端', link: '/zh/docs/web' },
						{ text: 'Android 应用', link: '/zh/docs/android' }
					]
				}
			]
		}
	}
};
