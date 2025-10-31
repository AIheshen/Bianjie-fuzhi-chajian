(function() {
    'use strict';

    // 初始化数据 - 使用Chrome存储API替代GM_* API
    let abbreviations = {};
    let templates = [];
    let position = {
        left: null,
        top: null
    };
    const MAX_TEMPLATES = 10;
    let currentTemplateIndex = -1;
    let isCollapsed = false;

    // 从Chrome存储加载数据
    function loadData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['abbreviations', 'templates', 'abbreviation_tool_position', 'abbreviation_tool_collapsed'], (result) => {
                abbreviations = result.abbreviations || {};
                templates = result.templates || [];
                position = result.abbreviation_tool_position || { left: null, top: null };
                isCollapsed = result.abbreviation_tool_collapsed || false;
                
                // 检查是否有初始模板，如果没有则添加（确保两个默认模板存在）
                if (templates.length === 0) {
                    const markdownTemplate = {
                        name: "Markdown",
                        state: JSON.parse(JSON.stringify(abbreviations)),
                        isDefault: true
                    };

                    const contentEvalTemplate = {
                        name: "效果评估",
                        state: {
                            "URL失效": "url页面无法打开",
                            "无关": "非stem&code领域",
                            "无价值": "无训练价值内容",
                            "404": "url打不开404问题",
                            "时效性": "因时效性内容变化较大，无法判断完整性，废弃",
                            "抓取": "其他： \n内容抓取失败",
                            "导航少": "url和html导航栏内容少量不一致：\n（1）",
                            "导航大": "url和html导航栏内容大量不一致：\n（1）",
                            "正文少": "轻微不一致（少量正文内容不一致）：\n（1）",
                            "正文大": "严重不一致（大量正文内容不一致）：\n（1）",
                            "标题": "url和html标题缺失或不一致：",
                            "目录": "url和html的目录\\大纲少量不一致：\n（1）\nurl和html的目录\\大纲大量不一致：\n（1）",
                            "代码": "个别代码不一致：\n（1）\n3个及以上代码&代码块内容不一致：\n（1）",
                            "公式": "个别公式不一致：\n3个及以上公式不一致：",
                            "表格": "轻微不一致（url和html的表格内少量\\不重要信息不一致）：\n（1）\n严重不一致（url和html的表格内大量\\重要信息不一致）：\n（1）",
                            "语言": "url和抓取html语言不一致"
                        },
                        isDefault: true
                    };

                    // 添加两个默认模板，标记为不可删除
                    templates.push(markdownTemplate, contentEvalTemplate);
                    saveData('templates', templates);
                }
                
                resolve();
            });
        });
    }

    // 保存数据到Chrome存储
    function saveData(key, value) {
        const data = {};
        data[key] = value;
        chrome.storage.local.set(data);
    }

    // 配色方案
    const PRIMARY_COLOR = '#165DFF';
    const SECONDARY_COLOR = '#6B7280';
    const DANGER_COLOR = '#DC2626';
    const SUCCESS_COLOR = '#10B981';
    const NEUTRAL_COLOR = '#F3F4F6';
    const WARNING_COLOR = '#F59E0B';

    // 添加样式（从原脚本完整迁移）
    const style = document.createElement('style');
    style.textContent = `
        #abbreviation-container {
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            width: 100px;
            background-color: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 8px 20px -5px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: all 0.3s ease;
            box-sizing: border-box;
        }

        #abbreviation-header {
            padding: 6px 8px;
            background-color: ${PRIMARY_COLOR};
            color: white;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            white-space: nowrap;
            box-sizing: border-box;
        }

        #collapse-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border-radius: 3px;
            transition: all 0.2s;
            font-family: Arial, sans-serif;
        }

        #collapse-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        #abbreviation-content {
            padding: 4px;
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .abbreviation-item {
            display: flex;
            align-items: center;
            gap: 3px;
            padding: 4px 6px;
            background-color: ${NEUTRAL_COLOR};
            border-radius: 5px;
            transition: all 0.2s ease;
            cursor: pointer;
        }

        .abbreviation-item:hover {
            background-color: #E5E7EB;
        }

        .abbreviation-text {
            flex: 1;
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .abbreviation-btn {
            padding: 2px 5px;
            background-color: ${PRIMARY_COLOR};
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2px;
        }

        .abbreviation-btn:hover {
            background-color: #0D47A1;
        }

        .add-btn {
            background-color: ${SUCCESS_COLOR};
        }

        .add-btn:hover {
            background-color: #059669;
        }

        .template-btn {
            background-color: ${SECONDARY_COLOR};
        }

        .template-btn:hover {
            background-color: #4B5563;
        }

        .change-template-btn {
            background-color: ${PRIMARY_COLOR};
        }

        .change-template-btn:hover {
            background-color: #0D47A1;
        }

        .new-template-btn {
            background-color: ${WARNING_COLOR};
        }

        .new-template-btn:hover {
            background-color: #D97706;
        }

        .delete-btn {
            color: ${DANGER_COLOR};
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            padding: 0 2px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .delete-btn:hover {
            color: #991B1B;
        }

        #dialog-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.4);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }

        #dialog-container.active {
            opacity: 1;
            visibility: visible;
        }

        .dialog {
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            width: 350px;
            max-width: 90%;
            transform: scale(0.9);
            transition: transform 0.3s ease;
        }

        #dialog-container.active .dialog {
            transform: scale(1);
        }

        .dialog-header {
            padding: 15px 20px;
            border-bottom: 1px solid #E5E7EB;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .dialog-title {
            font-size: 18px;
            font-weight: 600;
            color: #1F2937;
        }

        .dialog-close {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 20px;
            color: #6B7280;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .dialog-close:hover {
            color: #4B5563;
        }

        .dialog-content {
            padding: 20px;
        }

        .dialog-footer {
            padding: 15px 20px;
            border-top: 1px solid #E5E7EB;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .dialog-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .dialog-primary-btn {
            background-color: ${PRIMARY_COLOR};
            color: white;
        }

        .dialog-primary-btn:hover {
            background-color: #0D47A1;
        }

        .dialog-secondary-btn {
            background-color: #E5E7EB;
            color: #4B5563;
        }

        .dialog-secondary-btn:hover {
            background-color: #D1D5DB;
        }

        .dialog-warning-btn {
            background-color: ${WARNING_COLOR};
            color: white;
        }

        .dialog-warning-btn:hover {
            background-color: #D97706;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-label {
            display: block;
            margin-bottom: 5px;
            font-size: 14px;
            font-weight: 500;
            color: #4B5563;
        }

        .form-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #D1D5DB;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
        }

        .form-input:focus {
            outline: none;
            border-color: ${PRIMARY_COLOR};
            box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2);
        }

        .template-list {
            margin: 0;
            padding: 0;
            list-style: none;
            max-height: 200px;
            overflow-y: auto;
        }

        .template-item {
            padding: 10px;
            border-bottom: 1px solid #E5E7EB;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.2s;
        }

        .template-item:last-child {
            border-bottom: none;
        }

        .template-item:hover {
            background-color: ${NEUTRAL_COLOR};
        }

        .template-name {
            font-size: 14px;
            font-weight: 500;
        }

        .template-time {
            font-size: 12px;
            color: #6B7280;
        }

        .empty-state {
            padding: 20px;
            text-align: center;
            color: #6B7280;
            font-size: 14px;
        }

        .copy-indicator {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: ${SUCCESS_COLOR};
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 10001;
        }

        .copy-indicator.active {
            opacity: 1;
        }

        /* 折叠状态样式 */
        #abbreviation-container.collapsed {
            height: 32px;
            width: auto;
            min-width: 40px;
            max-width: 60px;
            overflow: hidden;
        }

        #abbreviation-container.collapsed #abbreviation-header {
            padding: 5px 6px;
        }

        #abbreviation-container.collapsed #abbreviation-content {
            display: none;
        }

        /* 拖拽优化 */
        .dragging {
            transition: none !important;
            cursor: grabbing !important;
            box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.2) !important;
            opacity: 0.95 !important;
            transform: scale(1.02) !important;
            z-index: 10000 !important;
        }
    `;
    document.head.appendChild(style);

    // 创建悬浮容器
    const container = document.createElement('div');
    container.id = 'abbreviation-container';
    document.body.appendChild(container);

    // 创建头部
    const header = document.createElement('div');
    header.id = 'abbreviation-header';
    header.innerHTML = `
        <span>复制工具</span>
        <button id="collapse-btn" title="折叠/展开">
            ▼
        </button>
    `;
    container.appendChild(header);

    // 创建内容区域
    const content = document.createElement('div');
    content.id = 'abbreviation-content';
    container.appendChild(content);

    // 创建按钮容器
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'buttons-container';
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.flexDirection = 'column';
    buttonsContainer.style.gap = '3px';
    content.appendChild(buttonsContainer);

    // 创建添加按钮
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '<i class="fa fa-plus"></i><span>+</span>';
    addBtn.className = 'abbreviation-btn add-btn';
    addBtn.addEventListener('click', showAddDialog);
    buttonsContainer.appendChild(addBtn);

    // 创建新建模板按钮
    const newTemplateBtn = document.createElement('button');
    newTemplateBtn.innerHTML = '<i class="fa fa-file-o"></i><span>新</span>';
    newTemplateBtn.className = 'abbreviation-btn new-template-btn';
    newTemplateBtn.addEventListener('click', startNewTemplate);
    buttonsContainer.appendChild(newTemplateBtn);

    // 创建保存模板按钮
    const saveTemplateBtn = document.createElement('button');
    saveTemplateBtn.innerHTML = '<i class="fa fa-save"></i><span>存</span>';
    saveTemplateBtn.className = 'abbreviation-btn template-btn';
    saveTemplateBtn.addEventListener('click', showSaveTemplateDialog);
    buttonsContainer.appendChild(saveTemplateBtn);

    // 创建更换模板按钮
    const changeTemplateBtn = document.createElement('button');
    changeTemplateBtn.innerHTML = '<i class="fa fa-exchange"></i><span>换</span>';
    changeTemplateBtn.className = 'abbreviation-btn change-template-btn';
    changeTemplateBtn.addEventListener('click', showChangeTemplateDialog);
    buttonsContainer.appendChild(changeTemplateBtn);

    // 创建复制提示元素
    const copyIndicator = document.createElement('div');
    copyIndicator.className = 'copy-indicator';
    copyIndicator.textContent = '已复制到剪贴板';
    document.body.appendChild(copyIndicator);

    // 创建对话框容器
    const dialogContainer = document.createElement('div');
    dialogContainer.id = 'dialog-container';
    document.body.appendChild(dialogContainer);

    // 更新按钮显示
    function updateButtons() {
        // 移除现有缩写按钮
        const existingItems = content.querySelectorAll('.abbreviation-item');
        existingItems.forEach(item => item.remove());

        // 添加所有缩写按钮
        Object.keys(abbreviations).forEach(abbr => {
            const item = document.createElement('div');
            item.className = 'abbreviation-item';
            item.innerHTML = `
                <span class="abbreviation-text" data-clipboard-text="${abbreviations[abbr]}">${abbr}</span>
                <button class="abbreviation-btn edit-btn" data-abbr="${abbr}">
                    编
                </button>
            `;
            content.insertBefore(item, buttonsContainer);

            // 添加点击复制事件
            const textSpan = item.querySelector('.abbreviation-text');
            textSpan.addEventListener('click', function() {
                const text = this.getAttribute('data-clipboard-text');
                copyToClipboard(text);
            });

            // 添加编辑事件
            const editBtn = item.querySelector('.edit-btn');
            editBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const abbr = this.getAttribute('data-abbr');
                showEditDialog(abbr);
            });
        });
    }

    // 复制到剪贴板并显示提示
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            copyIndicator.classList.add('active');
            setTimeout(() => {
                copyIndicator.classList.remove('active');
            }, 1500);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请手动复制');
        });
    }

    // 显示添加对话框
    function showAddDialog() {
        createDialog({
            title: '添加缩写',
            content: `
                <div class="form-group">
                    <label class="form-label">缩写文本</label>
                    <input type="text" id="add-abbreviation-text" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">复制内容</label>
                    <textarea id="add-copy-content" class="form-input" rows="4"></textarea>
                </div>
            `,
            confirmButtonText: '保存',
            onConfirm: function() {
                const abbrText = document.getElementById('add-abbreviation-text').value.trim();
                const copyContent = document.getElementById('add-copy-content').value;

                if (abbrText && copyContent) {
                    abbreviations[abbrText] = copyContent;
                    saveData('abbreviations', abbreviations);
                    updateButtons();
                    return true;
                } else {
                    alert('缩写文本和复制内容不能为空！');
                    return false;
                }
            }
        });
    }

    // 显示编辑对话框
    function showEditDialog(abbr) {
        createDialog({
            title: '编辑缩写',
            content: `
                <div class="form-group">
                    <label class="form-label">缩写文本</label>
                    <input type="text" id="edit-abbreviation-text" class="form-input" value="${abbr}">
                </div>
                <div class="form-group">
                    <label class="form-label">复制内容</label>
                    <textarea id="edit-copy-content" class="form-input" rows="4">${abbreviations[abbr]}</textarea>
                </div>
            `,
            confirmButtonText: '保存',
            confirmButtonClass: 'dialog-primary-btn',
            showCancelButton: true,
            onConfirm: function() {
                const newAbbrText = document.getElementById('edit-abbreviation-text').value.trim();
                const newCopyContent = document.getElementById('edit-copy-content').value;

                if (newAbbrText && newCopyContent) {
                    if (newAbbrText !== abbr) {
                        delete abbreviations[abbr];
                    }
                    abbreviations[newAbbrText] = newCopyContent;
                    saveData('abbreviations', abbreviations);
                    updateButtons();
                    return true;
                } else {
                    alert('缩写文本和复制内容不能为空！');
                    return false;
                }
            },
            onCreated: function() {
                // 添加删除按钮
                const dialogFooter = document.querySelector('.dialog-footer');
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'dialog-btn dialog-secondary-btn';
                deleteBtn.textContent = '删除';
                deleteBtn.addEventListener('click', function() {
                    if (confirm('确定要删除这个缩写吗？')) {
                        delete abbreviations[abbr];
                        saveData('abbreviations', abbreviations);
                        updateButtons();
                        dialogContainer.classList.remove('active');
                    }
                });
                dialogFooter.insertBefore(deleteBtn, dialogFooter.firstChild);
            }
        });
    }

    // 检查当前缩写是否与模板相同
    function isSameAsTemplate(templateIndex) {
        if (templateIndex === -1) return false;

        const template = templates[templateIndex];
        if (!template) return false;

        const currentKeys = Object.keys(abbreviations).sort();
        const templateKeys = Object.keys(template.state).sort();

        if (currentKeys.length !== templateKeys.length) return false;

        for (let i = 0; i < currentKeys.length; i++) {
            if (currentKeys[i] !== templateKeys[i] || abbreviations[currentKeys[i]] !== template.state[templateKeys[i]]) {
                return false;
            }
        }

        return true;
    }

    // 显示保存模板对话框
    function showSaveTemplateDialog() {
        if (currentTemplateIndex !== -1 && templates[currentTemplateIndex].isDefault) {
            alert('当前使用的是默认模板，无法直接保存。请创建新模板。');
            return;
        }

        if (currentTemplateIndex !== -1 && isSameAsTemplate(currentTemplateIndex)) {
            alert('当前内容与已保存模板相同，无需重复保存。');
            return;
        }

        createDialog({
            title: '保存当前缩写为模板',
            content: `
                <div class="form-group">
                    <label class="form-label">模板名称</label>
                    <input type="text" id="template-name" class="form-input" placeholder="请输入模板名称">
                </div>
                ${templates.length >= MAX_TEMPLATES ?
                  `<p style="color: ${DANGER_COLOR}">注意：最多只能保存${MAX_TEMPLATES}个模板，保存新模板将覆盖最早的模板。</p>` : ''}
            `,
            confirmButtonText: '保存模板',
            onConfirm: function() {
                const templateName = document.getElementById('template-name').value.trim();
                if (!templateName) {
                    alert('请输入模板名称！');
                    return false;
                }

                const existingIndex = templates.findIndex(t => t.name === templateName);
                if (existingIndex !== -1) {
                    if (!confirm('已存在同名模板，是否覆盖？')) {
                        return false;
                    }
                    templates.splice(existingIndex, 1);
                } else if (templates.length >= MAX_TEMPLATES) {
                    templates.shift();
                }

                templates.push({
                    name: templateName,
                    state: JSON.parse(JSON.stringify(abbreviations)),
                    time: new Date().toISOString()
                });

                currentTemplateIndex = templates.length - 1;
                saveData('templates', templates);

                alert('模板保存成功！');
                return true;
            }
        });
    }

    // 显示更换模板对话框
    function showChangeTemplateDialog() {
        if (templates.length === 0) {
            alert('没有可用的模板');
            return;
        }

        if (currentTemplateIndex !== -1 && !isSameAsTemplate(currentTemplateIndex) && Object.keys(abbreviations).length > 0) {
            createDialog({
                title: '保存当前模板',
                content: `
                    <p>当前模板已更改，是否保存？</p>
                `,
                confirmButtonText: '保存',
                confirmButtonClass: 'dialog-primary-btn',
                showCancelButton: true,
                cancelButtonText: '不保存',
                onConfirm: function() {
                    showSaveTemplateDialog();
                    setTimeout(showChangeTemplateDialog, 100);
                    return true;
                },
                onCancel: function() {
                    showChangeTemplateDialog();
                    return true;
                }
            });
            return;
        }

        createDialog({
            title: '选择要使用的模板',
            content: `
                <ul class="template-list" id="template-list">
                    ${templates.map((template, index) => `
                        <li class="template-item" data-index="${index}">
                            <div>
                                <div class="template-name">${template.name} ${template.isDefault ? '(默认)' : ''}</div>
                                <div class="template-time">${template.isDefault ? '不可删除' : formatDate(template.time)}</div>
                            </div>
                            <div>
                                <button class="delete-btn" data-index="${index}" ${template.isDefault ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            `,
            confirmButtonText: '取消',
            confirmButtonClass: 'dialog-secondary-btn',
            showCancelButton: false,
            onConfirm: function() {
                return true;
            },
            onCreated: function() {
                const templateItems = document.querySelectorAll('.template-item');
                templateItems.forEach(item => {
                    item.addEventListener('click', function(e) {
                        if (e.target.closest('.delete-btn')) return;

                        const index = this.getAttribute('data-index');
                        if (parseInt(index) === currentTemplateIndex) {
                            alert('当前已在使用该模板');
                            return;
                        }
                        loadTemplate(index);
                        dialogContainer.classList.remove('active');
                    });
                });

                const deleteButtons = document.querySelectorAll('.delete-btn');
                deleteButtons.forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const index = this.getAttribute('data-index');
                        if (templates[index].isDefault) {
                            alert('默认模板不能删除');
                            return;
                        }
                        if (confirm('确定要删除这个模板吗？')) {
                            templates.splice(index, 1);
                            if (currentTemplateIndex === parseInt(index)) {
                                currentTemplateIndex = -1;
                            } else if (currentTemplateIndex > parseInt(index)) {
                                currentTemplateIndex--;
                            }
                            saveData('templates', templates);
                            showChangeTemplateDialog();
                        }
                    });
                });
            }
        });
    }

    // 加载模板
    function loadTemplate(index) {
        const template = templates[index];
        if (!template) return;

        if (currentTemplateIndex !== -1 && !isSameAsTemplate(currentTemplateIndex) && Object.keys(abbreviations).length > 0) {
            createDialog({
                title: '保存当前模板',
                content: `
                    <p>当前模板已更改，是否保存？</p>
                `,
                confirmButtonText: '保存',
                confirmButtonClass: 'dialog-primary-btn',
                showCancelButton: true,
                cancelButtonText: '不保存',
                onConfirm: function() {
                    showSaveTemplateDialog();
                    setTimeout(() => {
                        abbreviations = JSON.parse(JSON.stringify(template.state));
                        saveData('abbreviations', abbreviations);
                        updateButtons();
                        currentTemplateIndex = parseInt(index);
                    }, 100);
                    return true;
                },
                onCancel: function() {
                    abbreviations = JSON.parse(JSON.stringify(template.state));
                    saveData('abbreviations', abbreviations);
                    updateButtons();
                    currentTemplateIndex = parseInt(index);
                    return true;
                }
            });
            return;
        }

        abbreviations = JSON.parse(JSON.stringify(template.state));
        saveData('abbreviations', abbreviations);
        updateButtons();
        currentTemplateIndex = parseInt(index);
    }

    // 开始新建模板流程
    function startNewTemplate() {
        if (currentTemplateIndex !== -1 && !isSameAsTemplate(currentTemplateIndex) && Object.keys(abbreviations).length > 0) {
            createDialog({
                title: '确认操作',
                content: `
                    <p>当前模板已更改，是否保存？</p>
                `,
                confirmButtonText: '保存',
                confirmButtonClass: 'dialog-primary-btn',
                showCancelButton: true,
                cancelButtonText: '不保存',
                onConfirm: function() {
                    showSaveTemplateDialog();
                    setTimeout(createNewTemplate, 100);
                    return true;
                },
                onCancel: function() {
                    createNewTemplate();
                    return true;
                }
            });
        } else if (Object.keys(abbreviations).length > 0) {
            createDialog({
                title: '确认操作',
                content: `
                    <p>当前有未保存的缩写内容，是否先保存为模板？</p>
                `,
                confirmButtonText: '保存',
                confirmButtonClass: 'dialog-primary-btn',
                showCancelButton: true,
                cancelButtonText: '不保存',
                onConfirm: function() {
                    showSaveTemplateDialog();
                    setTimeout(createNewTemplate, 100);
                    return true;
                },
                onCancel: function() {
                    createNewTemplate();
                    return true;
                }
            });
        } else {
            createNewTemplate();
        }
    }

    // 创建新模板
    function createNewTemplate() {
        abbreviations = {};
        saveData('abbreviations', abbreviations);
        currentTemplateIndex = -1;
        updateButtons();
        alert('已创建新模板，请添加缩写内容');
    }

    // 创建对话框
    function createDialog(options) {
        dialogContainer.innerHTML = `
            <div class="dialog">
                <div class="dialog-header">
                    <div class="dialog-title">${options.title}</div>
                    <button class="dialog-close">×</button>
                </div>
                <div class="dialog-content">
                    ${options.content}
                </div>
                <div class="dialog-footer">
                    ${options.showCancelButton !== false ? `<button id="dialog-cancel-btn" class="dialog-btn ${options.cancelButtonClass || 'dialog-secondary-btn'}">${options.cancelButtonText || '取消'}</button>` : ''}
                    <button id="dialog-confirm-btn" class="dialog-btn ${options.confirmButtonClass || 'dialog-primary-btn'}">${options.confirmButtonText}</button>
                </div>
            </div>
        `;

        dialogContainer.classList.add('active');

        document.getElementById('dialog-confirm-btn').addEventListener('click', function() {
            if (options.onConfirm && options.onConfirm()) {
                dialogContainer.classList.remove('active');
            }
        });

        if (document.getElementById('dialog-cancel-btn')) {
            document.getElementById('dialog-cancel-btn').addEventListener('click', function() {
                if (options.onCancel && options.onCancel()) {
                    dialogContainer.classList.remove('active');
                } else {
                    dialogContainer.classList.remove('active');
                }
            });
        }

        document.querySelector('.dialog-close').addEventListener('click', function() {
            dialogContainer.classList.remove('active');
        });

        dialogContainer.addEventListener('click', function(e) {
            if (e.target === dialogContainer) {
                dialogContainer.classList.remove('active');
            }
        });

        if (options.onCreated) {
            options.onCreated();
        }
    }

    // 格式化日期
    function formatDate(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 实现拖拽功能
    let isDragging = false;
    let offsetX, offsetY;
    let headerHeight;
    let lastX, lastY;
    let dragSpeed = 0;
    let animationId = null;

    header.addEventListener('mousedown', function(e) {
        if (e.target.closest('#collapse-btn')) return;

        isDragging = true;
        offsetX = e.clientX - container.getBoundingClientRect().left;
        offsetY = e.clientY - container.getBoundingClientRect().top;
                headerHeight = header.offsetHeight;
        lastX = e.clientX;
        lastY = e.clientY;

        container.classList.add('dragging');
        e.preventDefault();
    });

    function handleDrag(e) {
        if (!isDragging) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        if (newX < 0) {
            newX = 0;
        }

        if (newX + header.offsetWidth > viewportWidth) {
            newX = viewportWidth - header.offsetWidth;
        }

        if (newY < 0) {
            newY = 0;
        }

        if (newY + headerHeight > viewportHeight) {
            newY = viewportHeight - headerHeight;
        }

        dragSpeed = Math.sqrt(
            Math.pow(e.clientX - lastX, 2) +
            Math.pow(e.clientY - lastY, 2)
        );
        lastX = e.clientX;
        lastY = e.clientY;

        container.style.left = `${newX}px`;
        container.style.top = `${newY}px`;
        container.style.transform = 'none';

        position.left = newX;
        position.top = newY;
    }

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        if (animationId) {
            cancelAnimationFrame(animationId);
        }

        animationId = requestAnimationFrame(() => {
            handleDrag(e);
        });
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            container.classList.remove('dragging');
            if (animationId) {
                cancelAnimationFrame(animationId);
            }

            saveData('abbreviation_tool_position', position);
        }
    });

    // 折叠/展开功能
    document.getElementById('collapse-btn').addEventListener('click', function() {
        if (isCollapsed) {
            container.classList.remove('collapsed');
            container.style.width = '100px';
            header.querySelector('span').textContent = '复制工具';
            this.innerHTML = '▼';
            this.title = '折叠';
        } else {
            container.classList.add('collapsed');
            container.style.width = 'auto';
            header.querySelector('span').textContent = '复';
            this.innerHTML = '—';
            this.title = '展开';
        }
        isCollapsed = !isCollapsed;
        saveData('abbreviation_tool_collapsed', isCollapsed);
    });

    // 自动保存功能
    let autoSaveTimer;
    function scheduleAutoSave() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            saveData('abbreviations', abbreviations);
            console.log('自动保存成功');
        }, 2000);
    }

    // 监听缩写变化，自动保存
    const observer = new MutationObserver(mutations => {
        scheduleAutoSave();
    });

    observer.observe(content, {
        childList: true,
        subtree: true
    });

    // 初始化折叠状态
    function initCollapsedState() {
        if (isCollapsed) {
            container.classList.add('collapsed');
            header.querySelector('span').textContent = '复';
            document.getElementById('collapse-btn').innerHTML = '—';
            document.getElementById('collapse-btn').title = '展开';
        } else {
            document.getElementById('collapse-btn').innerHTML = '▼';
            document.getElementById('collapse-btn').title = '折叠';
        }
    }

    // 恢复保存的位置
    function restorePosition() {
        if (position.left !== null && position.top !== null) {
            container.style.left = position.left + 'px';
            container.style.top = position.top + 'px';
            container.style.transform = 'none';
        }
    }

    // 键盘快捷键支持
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            document.getElementById('collapse-btn').click();
        }
    });

    // 初始化
    async function init() {
        await loadData();
        restorePosition();
        initCollapsedState();
        updateButtons();
        console.log('复制工具已加载');
    }

    // 启动初始化
    init();
})();
