import { Header } from './components/Header';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 1. O Cabeçalho Fixo */}
      <Header />

      {/* 2. Área Principal (Onde vai ficar a busca e os gráficos) */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Placeholder para a Barra de Busca (Faremos a seguir) */}
        <div className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 text-center">
          <h2 className="text-xl font-semibold text-gray-700">
            Área da Busca e Dashboard
          </h2>
          <p className="text-gray-500 mt-2">Em breve...</p>
        </div>

      </main>

      {/* 3. Rodapé Simples */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="text-center text-sm text-gray-500">
          <p>© 2025 Vinicius Cardoso Garcia. Licenciado sob MIT.</p>
          <p className="mt-1 font-medium text-shark">
            Powered by ASSERT Lab. Orgulhosamente feito em Recife 🦈
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App