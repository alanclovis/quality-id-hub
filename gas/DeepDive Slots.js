function contarItensPorDistritoPorSemana() {
  const inicio = new Date();
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const abaOrigem = planilha.getSheetByName("H1.2026");
  const abaDestino = planilha.getSheetByName("DeepDive Slots");
  
  // Ajuste a última linha conforme necessário
  const ultimaLinha = 5000; 
  
  // Pegamos de A até AR (ajuste o final se sua planilha for mais larga que a coluna AR)
  const dadosOrigem = abaOrigem.getRange("A2:AR" + ultimaLinha).getValues();
  
  const resultadoTemp = {};
  let linhasProcessadas = 0;
  let itensProcessados = 0;

  for (let i = 0; i < dadosOrigem.length; i++) {
    const linha = dadosOrigem[i];
    
    // --- MAPEAMENTO DAS COLUNAS (A=0, B=1, C=2...) ---
    const data = linha[3];      // Coluna D (Data completa para extrair dia e mês)
    const semana = linha[4];    // Coluna E (Semana)
    const distrito = linha[5];  // Coluna F (Distrito)
    const analista = linha[6];  // Coluna G (Analista)
    
    // Os slots começam na coluna I (que é o índice 8). 
    // Do índice 0 ao 7 são os cabeçalhos (Líder até E-mail).
    const itens = linha.slice(8); 

    // Validação básica: se não tiver semana ou data, pula a linha.
    // (Removi o filtro "semana < 15" para processar tudo, se quiser voltar é só adicionar)
    if (!semana || !data || !distrito) continue;

    linhasProcessadas++;

    for (let j = 0; j < itens.length; j++) {
      const item = itens[j];
      if (!item) continue; // Pula células vazias nos slots

      // A chave única para agrupar e contar
      // Usamos a Data (linha[3]) ao invés do Dia da Semana para ter precisão
      const chave = `${semana}|||${data}|||${distrito}|||${item}|||${analista}`;
      
      resultadoTemp[chave] = (resultadoTemp[chave] || 0) + 1;
      itensProcessados++;
    }
  }

  // Cabeçalho da aba de destino
  const resultado = [["Semana", "Mês", "Dia", "Distrito", "Item", "Slots", "Horas", "Analista"]];

  for (let chave in resultadoTemp) {
    const [semanaStr, dataStr, distrito, item, analista] = chave.split("|||");
    
    // Converter a string de data de volta para Objeto Date para extrair o Mês
    let dataDia = new Date(dataStr);
    let mes = dataDia.getMonth() + 1; // getMonth() retorna 0-11, por isso +1
    
    const slots = resultadoTemp[chave];
    const horas = +(slots / 2).toFixed(1);
    
    // Monta a linha final na ordem solicitada
    resultado.push([
      parseInt(semanaStr), // Semana
      mes,                 // Mês
      dataDia,             // Dia (Data)
      distrito,            // Distrito
      item,                // Item
      slots,               // Slots
      horas,               // Horas
      analista             // Analista
    ]);
  }

  // Ordenação: Primeiro por Semana
  resultado.sort((a, b) => {
    if (a[0] === "Semana") return -1;
    return a[0] - b[0]; // Ordena número da semana
  });

  // Escrever na aba de destino
  abaDestino.clearContents();
  
  if (resultado.length > 0) {
    abaDestino.getRange(1, 1, resultado.length, resultado[0].length).setValues(resultado);
    
    // Formatações
    if (resultado.length > 1) {
      abaDestino.getRange(2, 3, resultado.length - 1, 1).setNumberFormat("dd/mm/yyyy"); // Coluna C (Dia)
      abaDestino.getRange(2, 7, resultado.length - 1, 1).setNumberFormat("0.0");        // Coluna G (Horas)
    }
  }

  // Logs de performance
  const fim = new Date();
  const duracaoMs = fim - inicio;
  const duracaoSegundos = (duracaoMs / 1000).toFixed(2);
  
  console.log("Execução finalizada.");
  console.log(`Linhas processadas: ${linhasProcessadas}`);
  console.log(`Itens processados: ${itensProcessados}`);
  console.log(`Tempo total: ${duracaoSegundos} segundos`);
}