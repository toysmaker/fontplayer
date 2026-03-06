const panels = {
	zh: {
		filter: {
			all: '全部组件',
			font: '字体组件',
		},
		view: '视图',
		componentList: {
			menu: {
				cut: '剪切',
				copy: '复制',
				paste: '粘贴',
				delete: '删除',
			},
		},
		viewList: {
			thumbnail: {
				title: '缩略图片',
				description: '原图的适应屏幕缩略图片',
			},
			bitmap: {
				title: '黑白位图',
				description: '经过黑白二分化处理的图片',
			},
			contours: {
				title: '轮廓',
				description: '从图片中提取的轮廓线',
			},
			curves: {
				title: '曲线拟合',
				description: '从轮廓中拟合的曲线集合',
			},
			preview: {
				title: '预览',
				description: '填色效果预览',
			}
		},
		paramsPanel: {
			componentName: {
				title: '组件名称',
				label: '名称',
			},
			transform: {
				title: '变换',
				x: '位置X',
				y: '位置Y',
				w: '缩放W',
				h: '缩放H',
				rotation: '旋转',
				flipX: '横向翻转',
				flipY: '纵向翻转',
			},
			opacity: {
				title: '样式',
				opacity: '透明度',
			},
			editMode: {
				title: '编辑模式',
				label: '开启',
			},
			transformToCurve: {
				title: '转换为钢笔路径',
				label: '确认转换为钢笔路径',
			},
			layout: {
				title: '布局',
				add: '添加布局',
				modify: '修改布局',
				type: '类型',
				null: '无布局',
				rect: '矩形布局',
			},
			params: {
				title: '参数',
			},
			joints: {
				title: '关键点',
			},
			fillColor: {
				title: '填充颜色',
				label: '颜色',
			},
			width: '宽度',
			height: '高度',
			horizontalFlip: '水平翻转',
			verticalFlip: '垂直翻转',
			offset: '偏移',
			formatComponent: {
				title: '格式化组件',
				button: '格式化字形组件',
				confirmMsg: '格式化字形组件会将字形组件改为普通钢笔组件，失去参数化功能，不可恢复，是否进行格式化？',
			},
			layoutEditing: {
				title: '编辑结构',
				interactive: '交互设定',
				draggable: '可拖拽',
				draggableOption: '拖拽设定',
				dragOption: '拖拽参考',
				dragOptionNone: '无',
				dragOptionDefault: '默认标点',
				dragOptionLayout: '布局比例',
				globalParam: '全局变量',
				cancelGlobalParam: '取消全局变量',
				setAsGlobalParam: '设为全局变量',
				selectGlobalParam: '选择全局变量',
				updateGlobalParam: '更新全局变量',
				applyGridTransform: '应用布局变换',
				resetGridTransform: '重置布局变换',
				applyMetricsTransform: '应用度量变换',
				resetMetricsTransform: '重置度量变换',
				applyGridConfirmMsg: '应用布局变换会格式化所有字形组件，该操作不可恢复，确定应用？',
				loadingMsg: '加载中，请稍候……',
				loadedMsg: '加载中，请稍候……已加载{percent}%',
			},
			interactive: '交互设定',
			draggable: '可拖拽',
			draggableOption: '拖拽设定',
			dragOption: '拖拽参考',
			dragOptionNone: '无',
			dragOptionDefault: '默认标点',
			dragOptionLayout: '布局比例',
			globalParam: '全局变量',
			cancelGlobalParam: '取消全局变量',
			setAsGlobalParam: '设为全局变量',
			selectGlobalParam: '选择全局变量',
			updateGlobalParam: '更新全局变量',
			applyGridTransform: '应用布局变换',
			resetGridTransform: '重置布局变换',
			applyMetricsTransform: '应用度量变换',
			resetMetricsTransform: '重置度量变换',
			applyGridConfirmMsg: '应用布局变换会格式化所有字形组件，该操作不可恢复，确定应用？',
			loadingMsg: '加载中，请稍候……',
			loadedMsg: '加载中，请稍候……已加载{percent}%',
		},
		picEditPanel: {
			cancel: '取消',
			confirm: '确定',
			remove: '删除',
			reset: '重置',
			edit: '编辑',
			step1: {
				title: '步骤一：黑白二分化',
				tip: '效果不佳？试试',
				localBrush: '局部笔刷',
				brush: '笔刷',
			},
			step2: {
				title: '步骤二：提取轮廓路径',
				content: '系统会根据第一步的结果自动提取轮廓',
			},
			step3: {
				title: '步骤三：将轮廓拟合成曲线',
				maxError: '平滑',
				dropThresholding: '过滤',
			},
			step4: {
				title: '步骤四：填充轮廓',
				content: '已自动填充为黑色',
			}
		},
		settingsPanel: {
			background: {
				background: '背景',
				style: '样式',
				color: '纯色',
				transparent: '透明',
			},
			mesh: {
				mesh: '网格',
				style: '样式',
				none: '无',
				mi: '米字格',
				precision: '精度',
				layout: '布局',
			},
			render: {
				render: '渲染',
				style: '样式',
				contour: '线框',
				black: '黑白',
				color: '彩色',
				title: '预览模式',
			},
		},
		bottomBar: {
			reset: '归零',
			coords: '坐标',
		},
		filesBar: {
			advancedEdit: '高级编辑',
			searchCharacter: '搜索字符',
			search: '搜索',
			searchPlaceholder: '请输入要搜索的字符（1-100个字符）',
			searchWarning: '请输入搜索关键词（1-100个字符）',
			searchWarningTooLong: '搜索关键词不能超过100个字符',
		},
		toolBar: {
			characterList: '字符列表',
		},
		componentList: {
			noComponents: '暂无组件',
			warningEditingCharacterEmpty: '警告: editingCharacter 为空',
		},
		rightPanel: {
			selectComponent: '请选择一个组件进行编辑',
		},
		editorMain: {
			featureInDevelopment: '功能开发中...',
			character: '字符',
			stroke: '笔画',
			radical: '部首',
			comp: '部件',
			glyph: '字形',
		},
		loading: {
			loading: '正在加载...',
			initializing: '正在初始化...',
			loadingProject: '正在加载工程文件...',
		},
		editorSidebar: {
			onlyOneProjectWarning: '目前字玩仅支持同时编辑一个工程，请关闭当前工程再新建。注意，关闭工程前请保存工程以避免数据丢失。',
		},
	},
	en: {
		filter: {
			all: 'All Componnents',
			font: 'Font COmponnents',
		},
		view: 'View',
		componentList: {
			menu: {
				cut: 'Cut',
				copy: 'Copy',
				paste: 'Paste',
				delete: 'Delete',
			},
		},
		viewList: {
			thumbnail: {
				title: 'Picture Thumbnail',
				description: 'Thumbnail of original picture',
			},
			bitmap: {
				title: 'Bitmap',
				description: 'Bitmap picture after thresholding processing',
			},
			contours: {
				title: 'Contours',
				description: 'Contours extracted from picture',
			},
			curves: {
				title: 'Curves',
				description: 'Curves fitted from contours',
			},
			preview: {
				title: 'Preview',
				description: 'Components preview',
			}
		},
		paramsPanel: {
			componentName: {
				title: 'Component Name',
				label: 'Name',
			},
			transform: {
				title: 'Transform',
				x: 'X',
				y: 'Y',
				w: 'W',
				h: 'H',
				rotation: 'Rotation',
				flipX: 'flipX',
				flipY: 'flipY',
			},
			opacity: {
				title: 'Style',
				opacity: 'Opacity',
			},
			editMode: {
				title: 'Edit Mode',
				label: 'Open'
			},
			transformToCurve: {
				title: 'Transform To Pen Curve',
				label: 'Confirm to transform'
			},
			layout: {
				title: 'Layout',
				add: 'Add Layout',
				modify: 'Modify Layout',
				type: 'Type',
				null: 'Empty Layout',
				rect: 'Rect Layout',
			},
			params: {
				title: 'Parameters',
			},
			joints: {
				title: 'Key Points',
			},
			fillColor: {
				title: 'Fill Color',
				label: 'Color',
			},
			width: 'Width',
			height: 'Height',
			horizontalFlip: 'Horizontal Flip',
			verticalFlip: 'Vertical Flip',
			offset: 'Offset',
			formatComponent: {
				title: 'Format Component',
				button: 'Format Glyph Component',
				confirmMsg: 'Formatting the glyph component will convert it to a normal pen component, losing parameterization, and this action cannot be undone. Do you want to proceed with formatting?',
			},
			layoutEditing: {
				title: 'Layout Editing',
				interactive: 'Interactive Settings',
				draggable: 'Draggable',
				draggableOption: 'Option',
				dragOption: 'Reference',
				dragOptionNone: 'None',
				dragOptionDefault: 'Default Punctuation',
				dragOptionLayout: 'Layout Proportion',
				globalParam: 'Global Parameter',
				cancelGlobalParam: 'Clear Global Parameter',
				setAsGlobalParam: 'Set as Global Parameter',
				selectGlobalParam: 'Select Global Parameter',
				updateGlobalParam: 'Update Global Parameter',
				applyGridTransform: 'Apply Grid Transform',
				resetGridTransform: 'Reset Grid Transform',
				applyGridConfirmMsg: 'Apply grid tansform needs to format all glyph components, and this action cannot be undone. Do you want to proceed transform?',
				applyMetricsTransform: 'Apply Metrics Transform',
				resetMetricsTransform: 'Reset Metrics Transform',
				loadingMsg: 'Loading, please wait...',
				loadedMsg: 'Loading in progress ({percent}% completed)',
			},
			interactive: 'Interactive Settings',
			draggable: 'Draggable',
			draggableOption: 'Option',
			dragOption: 'Reference',
			dragOptionNone: 'None',
			dragOptionDefault: 'Default Punctuation',
			dragOptionLayout: 'Layout Proportion',
			globalParam: 'Global Parameter',
			cancelGlobalParam: 'Clear Global Parameter',
			setAsGlobalParam: 'Set as Global Parameter',
			selectGlobalParam: 'Select Global Parameter',
			updateGlobalParam: 'Update Global Parameter',
			applyGridTransform: 'Apply Grid Transform',
			resetGridTransform: 'Reset Grid Transform',
			applyMetricsTransform: 'Apply Metrics Transform',
			resetMetricsTransform: 'Reset Metrics Transform',
			applyGridConfirmMsg: 'Apply grid tansform needs to format all glyph components, and this action cannot be undone. Do you want to proceed transform?',
			loadingMsg: 'Loading, please wait...',
			loadedMsg: 'Loading in progress ({percent}% completed)',
		},
		picEditPanel: {
			cancel: 'Cancel',
			confirm: 'Confirm',
			remove: 'Delete',
			reset: 'Reset',
			edit: 'Edit',
			step1: {
				title: 'Step 1: Bitmap Thresholding',
				tip: 'The effect is poor? Try',
				localBrush: 'Local Brush',
				brush: 'Brush',
			},
			step2: {
				title: 'Step 2: Extract Contours',
				content: 'Extract contours accordding to step 1\'s result',
			},
			step3: {
				title: 'Step 3: Fit Curve',
				maxError: 'Smoothing',
				dropThresholding: 'Filter',
			},
			step4: {
				title: 'Step 4: Fill Color',
				content: 'Auto-fill with black color',
			}
		},
		settingsPanel: {
			background: {
				background: 'Background',
				style: 'Style',
				color: 'Color',
				transparent: 'Transparent',
			},
			mesh: {
				mesh: 'Mesh',
				style: 'Style',
				none: 'None',
				mi: 'Mi',
				precision: 'Pricision',
				layout: 'Layout',
			},
			render: {
				render: 'Render',
				style: 'Style',
				contour: 'Contour',
				black: 'Black',
				color: 'Color',
				title: 'Preview Style',
			},
		},
		bottomBar: {
			reset: 'Reset',
			coords: 'Coords',
		},
		filesBar: {
			advancedEdit: 'Advanced Edit',
			searchCharacter: 'Search Character',
			search: 'Search',
			searchPlaceholder: 'Please enter characters to search (1-100 characters)',
			searchWarning: 'Please enter search keyword (1-100 characters)',
			searchWarningTooLong: 'Search keyword cannot exceed 100 characters',
		},
		toolBar: {
			characterList: 'Character List',
		},
		componentList: {
			noComponents: 'No Components',
			warningEditingCharacterEmpty: 'Warning: editingCharacter is empty',
		},
		rightPanel: {
			selectComponent: 'Please select a component to edit',
		},
		editorMain: {
			featureInDevelopment: 'Feature in development...',
			character: 'Character',
			stroke: 'Stroke',
			radical: 'Radical',
			comp: 'Component',
			glyph: 'Glyph',
		},
		loading: {
			loading: 'Loading...',
			initializing: 'Initializing...',
			loadingProject: 'Loading project file...',
		},
		editorSidebar: {
			onlyOneProjectWarning: 'FontPlayer currently only supports editing one project at a time. Please close the current project before creating a new one. Note: Please save the project before closing to avoid data loss.',
		},
	}
}

export {
	panels,
}
