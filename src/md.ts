import { App, FrontMatterCache, Notice, TFile } from "obsidian";
import { bannedProp, bannedFolder, bannedPropInTable } from "main";

export class MDIO{
    app:App;
    path:string;
    tfile: TFile;

    constructor(app: App, path: string) {
        this.app = app;
        this.path = path;
    }
    // 方便的获取TFlie
	getTFile(){
		for (var file of this.app.vault.getMarkdownFiles()) {
			if (file.path == this.path) {
				return file;
			}
		}
	}
    // 方便的写入
    async write(content: string) {
        await this.app.vault.modify(this.getTFile(), content)
    }

    /**
     * ================================================================
     * yaml属性常用函数
     * ================================================================
     */

    /**
     * 判断当前文档是否含有yaml
     * @returns 
     */
    hasYaml() {
        var cache = this.app.metadataCache.getCache(this.path);
        if (cache.hasOwnProperty("sections")) {
            if (cache["sections"][0]["type"] == "yaml") {
                return true;
            }
        }
        return false
    }
    
    /**
     * 获取yaml起始行号
     * ！！请在确保有yaml的情况下调用当前函数！！
     * @returns yaml起始行号
     */
    getYamlStartLine() {
        return this.app.metadataCache.getCache(this.path)["sections"][0]["position"]["start"]["line"];
    }

    /**
     * 获取frontmatter
     * ！！请在确保有yaml的情况下调用当前函数！！
     * @returns FrontMatterCache
     */
    getFrontmatter() :FrontMatterCache{
        var cache = this.app.metadataCache.getCache(this.path);
        if (cache.hasOwnProperty("frontmatter")) {
            return cache["frontmatter"];
        }
        else {
            return {"position": {start: {line: 0, col: 0, offset: 0}, end: {line: 0, col: 0, offset: 0}}}
        }
    }
    /**
     * 获得当前文档的所有属性名称
     * @returns nameList
     */
    getPropertiesName():Array<string> {
        var nameList: Array<string> = new Array();
        if (this.hasYaml()) {
            for (var property in this.getFrontmatter()) {
                if (property != "position") {
                    nameList.push(property)
                }
            }
        }
        return nameList
    }

    hasProperty(property: string) {
        if (this.getPropertiesName().indexOf(property) != -1) {
            return true
        }
        return false
    }

    getPropertyValue(property: string) {
        var result = ""
        if (this.hasYaml()) {
            if (this.hasProperty(property)) {
                var value = this.getFrontmatter()[property]
                if (value instanceof Array) {
                    result = value.toString()
                }
                else {
                    result = String(value)
                }
            }
        }
        return result
    }

    /**
     * ================================================================
     * 此处是文档的最终操作函数区域
     *  每个函数执行操作前都需要判断当前文档是否有yaml
     *  1、添加属性 -> 无yaml新建/有yaml继续 -> 无属性/有属性判断是否存在该属性，不存在则添加
     *  2、删除属性 -> 无yaml退出/有yaml继续 -> 无属性则退出/有属性判断是否存在该属性且不为重要属性则删除
     *  3、修改属性名 -> 无yaml退出/有yaml继续 -> 无属性则退出/有属性判断是否存在该属性且不为重要属性则修改名称
     *  4、修改属性值 -> 无yaml退出/有yaml继续 -> 无属性则退出/有属性判断是否存在该属性且不为重要属性则修改值
     *  5、删除整个YAML -> 无yaml退出/有yaml继续
     * ================================================================
     */
    /**
     * 为当前文档添加属性
     * @param newProperty 
     * @param value 
     */
	addProperty(newProperty:string, value="") {
        if (this.hasYaml()) {
            // 检测当前文档是否不存在该属性，不存在则添加
            if (!this.hasProperty(newProperty)) {
                this.app.vault.read(this.getTFile()).then(oldContent => {
                    var oldContentList = oldContent.split("\n");
    
                    // 添加新属性
                    oldContentList.splice(this.getYamlStartLine()+1, 0, `${newProperty}: '${value.replace(/'/g, '"')}'`)
                    var newContent = "";
                    for (var line of oldContentList) {
                        newContent = newContent + line + "\n";
                    }
    
                    // 写入
                    this.write(newContent)
                });
            }
        }
        else {
            // 检测当前文档是否不存在该属性，不存在则添加
            if (!this.hasProperty(newProperty)) {
                this.app.vault.read(this.getTFile()).then(oldContent => {
                    // 添加新属性
                    var newContent = `---\n${newProperty}: '${value.replace(/'/g, '"')}'\n---\n` + oldContent;
    
                    // 写入
                    this.write(newContent)
                });
            }
        }
	}
    // 为当前文档更新属性名
	updatePropertyName(oldProperty:string, newProperty:string) {
        if (this.hasYaml()) {
            // 是否存在该属性？且新属性名是否不存在？
            if (this.hasProperty(oldProperty) && !this.hasProperty(newProperty)) {
                // 检测是否为禁止操作项？
                if (bannedProp.split("\n").indexOf(oldProperty)==-1) {   // 不是禁止操作项
                    this.app.vault.read(this.getTFile()).then(oldContent => {
                        if (oldContent.indexOf(`\n${oldProperty}: `)) {
                            var newContent = oldContent.replace(`\n${oldProperty}:`, `\n${newProperty}:`)
                        }
                        else{
                            var newContent = oldContent.replace(`\n${oldProperty}:`, `\n${newProperty}: `)
                        }
                        
                        // 写入
                        this.write(newContent)
                    });
                }
            }
        }
	}
    
    // 表格更改属性值
	tableUpdateProperty(Property:string, newValue:string) {
        if (this.hasYaml()) {
            // 是否存在该属性？
            if (this.hasProperty(Property)) {
                // 检测是否为禁止操作项？
                if (bannedPropInTable.split("\n").indexOf(Property)==-1) {   // 不是禁止操作项
                    this.app.vault.read(this.getTFile()).then(oldContent => {
                        // 找到Property的行号
                        var oldContentList = oldContent.split("\n");
                        var lineNo = 0;
                        for (var line of oldContentList) {
                            lineNo = lineNo + 1;	// 起始行行数为1，第二行就是2
                            // 第一次出现Property后开始进行操作，在这一行后面添加新行以输入属性和其值
                            if (line.startsWith(Property + ":")) {
                                break;
                            }
                        }
        
                        // 修改属性值
                        oldContentList.splice(lineNo-1, 1, `${Property}: '${newValue.replace(/'/g, '"')}'`)
                        var newContent = "";
                        for (var line of oldContentList) {
                            newContent = newContent + line + "\n";
                        }
        
                        // 写入
                        this.write(newContent)
                    });
                }
            }
        }
	}
    // 为当前文档更新属性值
	updatePropertyValue(Property:string, newValue:string) {
        if (this.hasYaml()) {
            // 是否存在该属性？
            if (this.hasProperty(Property)) {
                // 检测是否为禁止操作项？
                if (bannedProp.split("\n").indexOf(Property)==-1) {   // 不是禁止操作项
                    this.app.vault.read(this.getTFile()).then(oldContent => {
                        // 找到Property的行号
                        var oldContentList = oldContent.split("\n");
                        var lineNo = 0;
                        for (var line of oldContentList) {
                            lineNo = lineNo + 1;	// 起始行行数为1，第二行就是2
                            // 第一次出现Property后开始进行操作，在这一行后面添加新行以输入属性和其值
                            if (line.startsWith(Property+":")) {
                                break;
                            }
                        }
        
                        // 修改属性值
                        oldContentList.splice(lineNo-1, 1, `${Property}: '${newValue.replace(/'/g, '"')}'`)
                        var newContent = "";
                        for (var line of oldContentList) {
                            newContent = newContent + line + "\n";
                        }
        
                        // 写入
                        this.write(newContent)
                    });
                }
            }
        }
	}
    // 删除当前文档中的某个属性
	delProperty(delProperty:string) {
        if (this.hasYaml()) {
            // 是否存在该属性？
            if (this.hasProperty(delProperty)) {
                // 检测是否为禁止操作项？
                if (bannedProp.split("\n").indexOf(delProperty)==-1) {   // 不是禁止操作项
                    this.app.vault.read(this.getTFile()).then(oldContent => {
                        // 找到delProperty的行号
                        var oldContentList = oldContent.split("\n");
                        var lineNo = 0;
                        for (var line of oldContentList) {
                            lineNo = lineNo + 1;	// 起始行行数为1，第二行就是2
                            // 第一次出现delProperty后开始进行操作，在这一行后面添加新行以输入属性和其值
                            if (line.startsWith(delProperty + ":")) {
                                break;
                            }
                        }
        
                        // 删除该属性
                        oldContentList.splice(lineNo-1, 1);
                        var newContent = "";
                        for (var line of oldContentList) {
                            newContent = newContent + line + "\n";
                        }
        
                        // 写入
                        this.write(newContent)
                    });
                }
            }
        }
	}
    // 危！！删除当前文档的整个yaml
    delTheWholeYaml() {
        if(this.hasYaml()) {
            var canBeDeleted = true
            for (var propertyName of this.getPropertiesName()) {
                if(bannedProp.split("\n").indexOf(propertyName)!=-1) {
                    canBeDeleted = false
                    console.log(`${this.path} 中包含禁止删除和修改的属性:${propertyName}, 所以无法对当前文档进行删除整个YAML的操作。`)
                    break;
                }
            }
            // 如果不包含重要属性就可以删除
            if(canBeDeleted) {
                var cache = this.app.metadataCache.getCache(this.path)
                var startLine = cache["sections"][0]["position"]["start"]["line"];
                var endLine = cache["sections"][0]["position"]["end"]["line"];
                this.app.vault.read(this.getTFile()).then(oldContent => {
                    // 找到delProperty的行号
                    var oldContentList = oldContent.split("\n");
                    // 删除该属性
                    oldContentList.splice(startLine, endLine-startLine+1);
                    var newContent = "";
                    for (var line of oldContentList) {
                        newContent = newContent + line + "\n";
                    }
                    // 写入
                    this.write(newContent)
                });
            }
        }
    }
    // 清除值为空的属性
    clearEmptyProps(){
        if(this.hasYaml()) {
            for (var propertyName of this.getPropertiesName()) {
                if(!this.getPropertyValue(propertyName)) {
                    // 空值属性
                    // console.log(propertyName)
                    this.delProperty(propertyName)  // 删除函数会检测是否为重要属性
                }
            }
            // 清除完空值属性后若当前文档中没有属性，则会删除yaml
            setTimeout(() =>{
                if (!this.getPropertiesName().length) {
                    this.delTheWholeYaml()
                }
            }, 100)
        }
    }
    /**
     * ================================================================
     * tag常用函数
     * ================================================================
     */

    /**
     * 当前文档是否含有标签xx
     * @param TagName 前面不要加#号
     * @returns 
     */
    hasTag(TagName: string) {
        if (this.getTagsName().indexOf(TagName) != -1) {
            return true
        }
        // var cache = this.app.metadataCache.getCache(this.path);
        // if (cache.hasOwnProperty("tags")) {
        //     for (var item of cache["tags"]) {
        //         if (item.tag == `#${TagName}`) {
        //             return true
        //         }
        //     }
        // }
        return false
    }

    getTagsName():Array<string> {
        var nameList = new Array();
        var cache = this.app.metadataCache.getCache(this.path);
        if (cache.hasOwnProperty("tags")) {
            for (var item of cache["tags"]) {
                var tag = item.tag.replace("#", "")
                if (nameList.indexOf(tag)==-1) {
                    nameList.push(tag)
                }
            }
        }
        // 获取yaml中的tags、tag
        var tags = ""
        if (this.hasProperty("tags")) {
            tags = this.getPropertyValue("tags").replace(/\s/g, "")
        }
        else if(this.hasProperty("tag")) {
            tags = this.getPropertyValue("tag").replace(/\s/g, "")
        }
        if (tags) {
            for (var tag of tags.split(',')){
                if (nameList.indexOf(tag)==-1) {
                    nameList.push(tag)
                }
            }
        }
        return nameList
    }

}


export class Search{
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    getAllTagsName():Array<string> {
        var nameList = new Array();
        for (var file of this.app.vault.getMarkdownFiles()) {
            // 如果不是忽略文件夹下的文件就可以继续
            if (!this.isBannedFolder(file.path)) {
                for (var TagName of new MDIO(this.app, file.path).getTagsName()) {
                    if (nameList.indexOf(TagName) == -1) {
                        nameList.push(TagName)
                    }
                }
            }
        }
        return nameList
    }

    getAllYamlPropertiesName():Array<string> {
        var yamlPropertiesName = new Array();
        for (var file of this.app.vault.getMarkdownFiles()) {
            // 如果不是忽略文件夹下的文件就可以继续
            if (!this.isBannedFolder(file.path)) {
                for (var propertyName of new MDIO(this.app, file.path).getPropertiesName()) {
                    if (yamlPropertiesName.indexOf(propertyName) == -1) {
                        yamlPropertiesName.push(propertyName)
                    }
                }
            }
        }
        return yamlPropertiesName
    }

    getYamlPropertiesNameOfTfiles(tflies: Array<TFile>):Array<string> {
        var yamlPropertiesName = new Array();
        for (var file of tflies) {
            // 如果不是忽略文件夹下的文件就可以继续
            if (!this.isBannedFolder(file.path)) {
                for (var propertyName of new MDIO(this.app, file.path).getPropertiesName()) {
                    if (yamlPropertiesName.indexOf(propertyName) == -1) {
                        yamlPropertiesName.push(propertyName)
                    }
                }
            }
        }
        return yamlPropertiesName
    }
    
    /**
     * 根据面板①的条件筛选文档
     * @param conditions 
     * @returns 
     */
    getSelectedTFiles(conditions: Array<Array<string>>):Array<TFile> {
        var tFiles = new Array()
        for (var file of this.app.vault.getMarkdownFiles()) {
            // 如果不是忽略文件夹下的文件就可以继续
            if (!this.isBannedFolder(file.path)) {
                var md = new MDIO(this.app, file.path)

                var fileSelected = true;

                // 条件判断
                for (var condition of conditions) {
                    // 1、yaml
                    if (condition[0] == "yaml") {
                        if (condition[1] == "包含") {
                            if (!md.hasProperty(condition[2])) {
                                fileSelected = false
                                break
                            }
                        }
                        else if(condition[1] == "不包含") {
                            if (md.hasProperty(condition[2])) {
                                fileSelected = false
                                break
                            }
                        }
                    }
                    else if (condition[0] == "yaml属性") {
                        if (!md.hasProperty(condition[1])) {
                            fileSelected = false
                            break
                        }
                        else if(String(md.getPropertyValue(condition[1])) != String(condition[2])) {
                            fileSelected = false
                            break
                        }
                    }
                    else if (condition[0] == "标签") {
                        if (condition[1] == "包含") {
                            if (!md.hasTag(condition[2])) {
                                fileSelected = false
                                break
                            }
                        }
                        else if(condition[1] == "不包含") {
                            if (md.hasTag(condition[2])) {
                                fileSelected = false
                                break
                            }
                        }
                    }
                    else if (condition[0] == "文件名称") {
                        var reg = new RegExp(condition[2]);
                        if (condition[1] == "符合") {
                            if (!file.basename.match(reg)) {
                                fileSelected = false
                                break
                            }
                        }
                        else if(condition[1] == "不符合") {
                            if (file.basename.match(reg)) {
                                fileSelected = false
                                break
                            }
                        }
                    }
                    else if (condition[0] == "文件路径") {
                        var reg = new RegExp(condition[2]);
                        if (condition[1] == "符合") {
                            if (!file.path.match(reg)) {
                                fileSelected = false
                                break
                            }
                        }
                        else if(condition[1] == "不符合") {
                            if (file.path.match(reg)) {
                                fileSelected = false
                                break
                            }
                        }
                    }
                }
                // 最终符合要求的存入数组
                if (fileSelected) {
                    tFiles.push(file)
                }
            }
        }
        return tFiles
    }

    getAllValuesOfAProperty(property: string):Array<string> {
        var valuesList = new Array();
        for (var file of this.app.vault.getMarkdownFiles()) {
            // 如果不是忽略文件夹下的文件就可以继续
            if (!this.isBannedFolder(file.path)) {
                var md = new MDIO(this.app, file.path) 
                if (valuesList.indexOf(md.getPropertyValue(property)) == -1) {
                    valuesList.push(md.getPropertyValue(property))
                }
            }
        }
        return valuesList
    }

    /**
     * 检测是否为忽略文件夹下的文件
     * @param path 
     * @returns 
     */
    isBannedFolder(path: string) {
        if (bannedFolder) {
            for (var folder of bannedFolder.split('\n')) {
                if(path.startsWith(folder)) {
                    return true
                }
            }
        }
        return false
    }
}