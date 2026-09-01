#!/bin/bash

# Script para gerar ícones do PWA a partir do logo SVG
# Requer ImageMagick instalado

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_SVG="$SCRIPT_DIR/public/assets/icons/logo.svg"
OUTPUT_DIR="$SCRIPT_DIR/public/icons"

# Tamanhos dos ícones para PWA
SIZES=(72 96 128 144 152 192 384 512)

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🎨 Gerador de Ícones PWA - Gatuno${NC}"
echo "=================================="

# Verificar se o ImageMagick está instalado
if ! command -v convert &> /dev/null && ! command -v magick &> /dev/null; then
    echo -e "${RED}❌ Erro: ImageMagick não está instalado.${NC}"
    echo "Instale com: sudo apt install imagemagick"
    exit 1
fi

# Verificar se o arquivo SVG existe
if [ ! -f "$SOURCE_SVG" ]; then
    echo -e "${RED}❌ Erro: Arquivo SVG não encontrado: $SOURCE_SVG${NC}"
    exit 1
fi

# Criar diretório de saída se não existir
mkdir -p "$OUTPUT_DIR"

echo -e "📁 Origem: $SOURCE_SVG"
echo -e "📁 Destino: $OUTPUT_DIR"
echo ""

# Determinar qual comando usar (magick para IMv7, convert para IMv6)
if command -v magick &> /dev/null; then
    CONVERT_CMD="magick"
else
    CONVERT_CMD="convert"
fi

# Gerar ícones
for size in "${SIZES[@]}"; do
    output_file="$OUTPUT_DIR/icon-${size}x${size}.png"

    echo -n "Gerando icon-${size}x${size}.png... "

    if $CONVERT_CMD -background none -density 300 "$SOURCE_SVG" -resize "${size}x${size}" -gravity center -extent "${size}x${size}" "$output_file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
done

echo ""
echo -e "${GREEN}✅ Ícones gerados com sucesso!${NC}"
echo ""

# Listar arquivos gerados
echo "Arquivos gerados:"
ls -lh "$OUTPUT_DIR"/icon-*.png 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
