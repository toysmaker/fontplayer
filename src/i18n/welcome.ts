const welcome = {
  zh: {
		new: {
			name: '新建工程',
			description: '新建字体（或web图标字体）工程',
		},
		open: {
			name: '打开工程',
			description: '打开已有字体（或web图标字体）工程',
		},
		import: {
			name: '导入字体库',
			description: '将字体库导入成新的字体（或web图标字体）工程',
		},
		sync: {
			name: '同步缓存',
			description: '同步缓存的字体（或web图标字体）工程',
		},
		template: {
			name: '导入模板',
			description: '导入字玩自带的测试模板',
			webOnlyHint:
				'默认模板体积较大，在浏览器中加载会很慢且可能占用大量临时存储。请使用桌面版客户端导入模板。',
		},
		restore: {
			name: '恢复上次会话',
			description: '从会话快照恢复上次未保存的工程与编辑状态',
			success: '已恢复上次会话',
			failed: '会话快照不存在或已过期，无法恢复',
		},
		playground: {
			title: '玩一玩字玩',
			description: '通过参数化快速创建一个迷你字库',
		},
	},
	en: {
		new: {
			name: 'New Project',
			description: 'Create new font (or web font) project',
		},
		open: {
			name: 'Open Project',
			description: 'Open existed font (or web font) project',
		},
		import: {
			name: 'Import Font',
			description: 'Import font as project',
		},
		sync: {
			name: 'Sync Cache',
			description: 'Sync cache',
		},
		template: {
			name: 'Import Template',
			description: 'Import template that FontPlayer provides for testing',
			webOnlyHint:
				'The default template is large; loading it in a browser will be very slow and may use a lot of temporary storage. Please use the desktop app to import the template.',
		},
		restore: {
			name: 'Restore Last Session',
			description: 'Restore unsaved project and editing state from session snapshot',
			success: 'Last session restored',
			failed: 'Session snapshot missing or expired, unable to restore',
		},
		playground: {
			title: 'Playground',
			description: 'Quickly create a mini font library through parameterization',
		},
	},
}

export {
	welcome,
}
