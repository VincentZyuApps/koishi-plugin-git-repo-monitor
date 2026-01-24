import os

def convert_svg_to_txt():
    # 获取当前目录下所有的文件
    files = os.listdir('.')
    
    # 筛选出 svg 文件
    svg_files = [f for f in files if f.endswith('.svg')]
    
    if not svg_files:
        print("未找到任何 .svg 文件")
        return

    for svg_file in svg_files:
        # 构造目标文件名（例如：微信支付.svg -> 微信支付.txt）
        txt_file = os.path.splitext(svg_file)[0] + '.txt'
        
        try:
            # 以 UTF-8 编码读取 SVG 内容
            with open(svg_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 将内容写入 txt 文件
            with open(txt_file, 'w', encoding='utf-8') as f:
                f.write(content)
                
            print(f"成功转换: {svg_file} -> {txt_file}")
        except Exception as e:
            print(f"转换 {svg_file} 时出错: {e}")

if __name__ == "__main__":
    convert_svg_to_txt()