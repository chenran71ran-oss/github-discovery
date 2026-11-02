"""GIT Bot collector, organised in four layers (lower layers never import upper ones):

1. core   类型与静态配置：数据结构、分类体系、采集常量
2. blocks 积木层：可替换的抓取器、解析器、分类信号算法、翻译与模型
3. lab    实验层：把积木组装成分类策略与采集流水线，并用标注集评估效果
4. app    外交层：环境配置、日志、阶段调度、发布与命令行入口
"""
