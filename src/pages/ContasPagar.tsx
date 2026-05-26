import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  Search, 
  Check, 
  RotateCcw,
  Tag,
  AlertTriangle,
  Receipt,
  Clock,
  FileText
} from 'lucide-react';
import { format, isBefore, startOfDay, parseISO } from 'date-fns';

interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: string; // ISO String or date YYYY-MM-DD
  status: 'pending' | 'paid';
  createdAt: string;
  paymentDate?: string;
  category?: string;
  notes?: string;
}

const DEFAULT_CATEGORIES = [
  'Matéria-prima',
  'Embalagens',
  'Energia / Água',
  'Internet / Telefone',
  'Aluguel',
  'Impostos / Taxas',
  'Salários',
  'Manutenção',
  'Marketing / Divulgação',
  'Outros'
];

export default function ContasPagar() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    category: 'Matéria-prima',
    notes: '',
    customCategory: '',
    isCustomCategory: false
  });

  // Fetch bills from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'bills'),
      (snapshot) => {
        const list: Bill[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({ id: doc.id, ...data } as Bill);
        });
        
        // Sort by dueDate ascending, then createdAt descending
        list.sort((a, b) => {
          const tA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const tB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          const dateDiff = (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
          if (dateDiff !== 0) return dateDiff;
          
          const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (isNaN(cB) ? 0 : cB) - (isNaN(cA) ? 0 : cA);
        });
        
        setBills(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'bills')
    );
    return () => unsubscribe();
  }, []);

  // Set the categories options gathered from current bills + defaults
  const categoriesList = useMemo(() => {
    const dynamicCats = bills
      .map((b) => b.category)
      .filter((cat): cat is string => !!cat && !DEFAULT_CATEGORIES.includes(cat));
    return [...DEFAULT_CATEGORIES, ...Array.from(new Set(dynamicCats))];
  }, [bills]);

  // Open modal for editing
  const handleEditClick = (bill: Bill) => {
    setEditingBill(bill);
    const isCustom = !DEFAULT_CATEGORIES.includes(bill.category || '');
    const datePart = bill.dueDate ? bill.dueDate.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
    setFormData({
      description: bill.description,
      amount: bill.amount.toString(),
      dueDate: datePart,
      category: isCustom ? 'custom' : (bill.category || 'Matéria-prima'),
      notes: bill.notes || '',
      customCategory: isCustom ? (bill.category || '') : '',
      isCustomCategory: isCustom
    });
    setIsModalOpen(true);
  };

  // Open modal for new bill
  const handleNewClick = () => {
    setEditingBill(null);
    setFormData({
      description: '',
      amount: '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      category: 'Matéria-prima',
      notes: '',
      customCategory: '',
      isCustomCategory: false
    });
    setIsModalOpen(true);
  };

  // Toggle paid status instantly
  const handleToggleStatus = async (bill: Bill) => {
    try {
      const isPaid = bill.status === 'paid';
      const updatedData = {
        status: isPaid ? 'pending' : 'paid',
        paymentDate: isPaid ? deleteField() : new Date().toISOString()
      };
      
      const updatedModel = { ...bill, ...updatedData } as any;
      if (isPaid) {
        delete updatedModel.paymentDate;
      }

      await updateDoc(doc(db, 'bills', bill.id), updatedData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bills/${bill.id}`);
    }
  };

  // Delete bill
  const handleDeleteBill = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bills', id));
      setBillToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bills/${id}`);
    }
  };

  // Submit form (create/update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amountParsed = parseFloat(formData.amount.replace(',', '.'));
      if (isNaN(amountParsed) || amountParsed <= 0) {
        alert('Por favor, informe um valor maior que zero.');
        return;
      }

      if (!formData.description.trim()) {
        alert('Por favor, informe a descrição da conta.');
        return;
      }

      const finalCategory = formData.isCustomCategory 
        ? formData.customCategory.trim() 
        : formData.category;

      if (!finalCategory) {
        alert('Por favor, informe ou selecione uma categoria.');
        return;
      }

      // Format Due Date to start of day in ISO or simple timestamp
      const due = new Date(formData.dueDate + 'T12:00:00'); // prevents timezone shifts
      const dueISO = due.toISOString();

      const payData: Omit<Bill, 'id'> = {
        description: formData.description.trim(),
        amount: amountParsed,
        dueDate: dueISO,
        category: finalCategory,
        notes: formData.notes.trim(),
        status: editingBill ? editingBill.status : 'pending',
        createdAt: editingBill ? editingBill.createdAt : new Date().toISOString()
      };

      if (editingBill) {
        if (editingBill.paymentDate) {
          payData.paymentDate = editingBill.paymentDate;
        }
        await updateDoc(doc(db, 'bills', editingBill.id), payData as any);
      } else {
        await addDoc(collection(db, 'bills'), payData);
      }

      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(
        error, 
        editingBill ? OperationType.UPDATE : OperationType.CREATE, 
        editingBill ? `bills/${editingBill.id}` : 'bills'
      );
    }
  };

  // Filter logic helper to check if a pending bill is overdue
  const isOverdue = (bill: Bill) => {
    if (bill.status === 'paid' || !bill.dueDate) return false;
    try {
      const today = startOfDay(new Date());
      const datePart = bill.dueDate.split('T')[0];
      const due = startOfDay(new Date(datePart + 'T12:00:00'));
      return isBefore(due, today);
    } catch {
      return false;
    }
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // 1. Search filter
      const matchesSearch = b.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.category && b.category.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 2. Category filter
      const matchesCategory = selectedCategory === 'all' || b.category === selectedCategory;

      // 3. Status filter
      let matchesStatus = true;
      if (statusFilter === 'pending') {
        matchesStatus = b.status === 'pending';
      } else if (statusFilter === 'paid') {
        matchesStatus = b.status === 'paid';
      } else if (statusFilter === 'overdue') {
        matchesStatus = isOverdue(b);
      }

      // 4. Period filter
      let matchesPeriod = true;
      if (b.dueDate) {
        const datePart = b.dueDate.split('T')[0];
        if (startDate && datePart < startDate) {
          matchesPeriod = false;
        }
        if (endDate && datePart > endDate) {
          matchesPeriod = false;
        }
      } else if (startDate || endDate) {
        matchesPeriod = false;
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesPeriod;
    });
  }, [bills, searchTerm, selectedCategory, statusFilter, startDate, endDate]);

  // Calculations for Kpis
  const kpis = useMemo(() => {
    let pendingSum = 0;
    let overdueSum = 0;
    let paidSum = 0;
    let overdueCount = 0;

    bills.forEach((b) => {
      if (b.status === 'paid') {
        paidSum += b.amount;
      } else {
        pendingSum += b.amount;
        if (isOverdue(b)) {
          overdueSum += b.amount;
          overdueCount++;
        }
      }
    });

    return {
      pendingSum,
      overdueSum,
      paidSum,
      overdueCount,
      totalCount: bills.length
    };
  }, [bills]);

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();

      // Configure PDF document properties
      doc.setProperties({
        title: 'Relatório de Contas a Pagar - Alambari Defumados',
        subject: 'Contas a Pagar',
        author: 'Alambari Defumados',
        creator: 'Alambari Defumados System'
      });

      // Banner/Header Background
      doc.setFillColor(31, 41, 55); // Dark Charcoal/Slate
      doc.rect(0, 0, 210, 40, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('ALAMBARI DEFUMADOS', 14, 18);

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(229, 231, 235);
      doc.text('Relatório de Contas a Pagar - Controle de Despesas', 14, 26);
      
      // Date of generation
      const todayFormatted = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text(`Gerado em: ${todayFormatted}`, 145, 26);

      // Section: Filter Details
      doc.setTextColor(31, 41, 55);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Parâmetros do Relatório', 14, 52);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);

      const periodText = (startDate || endDate)
        ? `${startDate ? format(new Date(startDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Qualquer data'} até ${endDate ? format(new Date(endDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Qualquer data'}`
        : 'Todos os períodos';
      
      const categoryText = selectedCategory === 'all' ? 'Todas as Categorias' : selectedCategory;
      
      const statusTextMap = {
        all: 'Todos',
        pending: 'Pendentes',
        paid: 'Pagas',
        overdue: 'Atrasadas'
      };
      const statusText = statusTextMap[statusFilter];

      doc.text(`Período de Vencimento: ${periodText}`, 14, 60);
      doc.text(`Categoria Selecionada: ${categoryText}`, 14, 66);
      doc.text(`Filtro de Status: ${statusText}`, 14, 72);

      // Quick Key Metrics/KPIs calculated on the filtered bills list
      let filteredPaidSum = 0;
      let filteredPendingSum = 0;
      let filteredOverdueSum = 0;

      filteredBills.forEach((b) => {
        if (b.status === 'paid') {
          filteredPaidSum += b.amount;
        } else {
          filteredPendingSum += b.amount;
          if (isOverdue(b)) {
            filteredOverdueSum += b.amount;
          }
        }
      });
      const filteredTotal = filteredPaidSum + filteredPendingSum;

      // Section: Summary Metrics Card Block
      doc.setFillColor(249, 250, 251); // Gray-50
      doc.rect(14, 78, 182, 30, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.rect(14, 78, 182, 30, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text('TOTAL PAGO', 20, 86);
      doc.text('PENDENTE A PAGAR', 65, 86);
      doc.text('DO PENDENTE: EM ATRASO', 115, 86);
      doc.text('TOTAL RELATÓRIO', 162, 86);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(16, 185, 129); // Emerald-500
      doc.text(`R$ ${filteredPaidSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, 96);

      doc.setTextColor(245, 158, 11); // Amber-500
      doc.text(`R$ ${filteredPendingSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 65, 96);

      doc.setTextColor(239, 68, 68); // Red-500
      doc.text(`R$ ${filteredOverdueSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 115, 96);

      doc.setTextColor(31, 41, 55); // Gray-800
      doc.text(`R$ ${filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 162, 96);

      // Section: Title for Table of Accounts
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      doc.text(`Detalhe das Contas Filtradas (${filteredBills.length} itens)`, 14, 118);

      // Prepare Table Data
      const tableColumn = ['Vencimento', 'Descrição / Credor', 'Categoria', 'Status', 'Valor (R$)'];
      const tableRows = filteredBills.map((bill) => {
        let billDateStr = '';
        try {
          if (bill.dueDate) {
            const datePart = bill.dueDate.split('T')[0];
            const parts = datePart.split('-');
            if (parts.length === 3) {
              billDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
              billDateStr = format(parseISO(bill.dueDate), 'dd/MM/yyyy');
            }
          }
        } catch {
          billDateStr = 'Data inválida';
        }

        let statusStr = 'Pendente';
        if (bill.status === 'paid') {
          statusStr = 'Pago';
        } else if (isOverdue(bill)) {
          statusStr = 'Atrasado';
        }

        return [
          billDateStr,
          bill.description + (bill.notes ? `\nObs: ${bill.notes}` : ''),
          bill.category || 'Geral',
          statusStr,
          bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ];
      });

      // Generate Table using AutoTable
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 124,
        theme: 'striped',
        headStyles: {
          fillColor: [185, 28, 28], // Red-700
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 26 }, // Date
          1: { cellWidth: 'auto' }, // Desc
          2: { cellWidth: 35 }, // Cat
          3: { cellWidth: 22, halign: 'center' }, // Status
          4: { cellWidth: 28, halign: 'right' } // Amount
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [55, 65, 81]
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        didParseCell: (data) => {
          // Highlight Atrasado rows in Red/Orange colors
          if (data.column.index === 3) {
            const cellValue = data.cell.text[0];
            if (cellValue === 'Atrasado') {
              data.cell.styles.textColor = [220, 38, 38]; // Red-600
              data.cell.styles.fontStyle = 'bold';
            } else if (cellValue === 'Pago') {
              data.cell.styles.textColor = [16, 185, 129]; // Emerald-500
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [245, 158, 11]; // Amber-500
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        didDrawPage: (data) => {
          // Footer
          const pageCount = doc.getNumberOfPages();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(156, 163, 175);
          doc.text(`Página ${data.pageNumber} de ${pageCount}`, 14, 285);
          doc.text('Alambari Defumados © - Sistema de Controle Integrado', 140, 285);
        }
      });

      // Show save dialog
      const fileDate = format(new Date(), 'yyyy-MM-dd_HH-mm');
      doc.save(`relatorio_contas_pagar_${fileDate}.pdf`);

    } catch (err) {
      console.error('Erro ao gerar relatório PDF:', err);
      alert('Ocorreu um erro ao exportar o relatório PDF.');
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Receipt className="h-7 w-7 text-red-500" /> Contas a Pagar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Controle de despesas, fornecedores e obrigações do Alambari Defumados.
          </p>
        </div>
        <button
          onClick={handleNewClick}
          className="bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg hover:bg-red-700 hover:shadow-xl transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="h-5 w-5" /> Nova Conta
        </button>
      </div>

      {/* KPI Cards section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card: Total Pendentes */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-500 shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-gray-500 font-medium text-xs uppercase tracking-wider">A Pagar (Pendente)</p>
            <p className="text-xl font-black text-gray-800 mt-0.5">
              R$ {kpis.pendingSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Card: Atrasadas */}
        <div className={`rounded-xl p-4 shadow-sm border transition-all flex items-center space-x-4 ${
          kpis.overdueCount > 0 
            ? 'bg-rose-50 border-rose-100 text-rose-800' 
            : 'bg-white border-gray-100'
        }`}>
          <div className={`p-3 rounded-lg shrink-0 ${
            kpis.overdueCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-500'
          }`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-gray-500 font-medium text-xs uppercase tracking-wider">Contas Atrasadas</p>
            <p className={`text-xl font-black mt-0.5 ${kpis.overdueCount > 0 ? 'text-rose-600' : 'text-gray-800'}`}>
              R$ {kpis.overdueSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">
              {kpis.overdueCount} {kpis.overdueCount === 1 ? 'conta com atraso' : 'contas com atraso'}
            </p>
          </div>
        </div>

        {/* Card: Total Pagas */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-500 shrink-0">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <p className="text-gray-500 font-medium text-xs uppercase tracking-wider">Total Pago</p>
            <p className="text-xl font-black text-gray-800 mt-0.5">
              R$ {kpis.paidSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Card: Próximos Lançamentos */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-500 shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-gray-500 font-medium text-xs uppercase tracking-wider">Total Lançado</p>
            <p className="text-xl font-black text-gray-800 mt-0.5">
              {(kpis.pendingSum + kpis.paidSum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">
              {kpis.totalCount} {kpis.totalCount === 1 ? 'conta registrada' : 'contas registradas'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Quick filters tabs */}
        <div className="flex border-b border-gray-100 md:border-none overflow-x-auto whitespace-nowrap scrollbar-thin rounded-lg bg-gray-50 p-1 shrink-0 gap-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-1.5 rounded-md font-bold text-xs transition-all ${
              statusFilter === 'all' 
                ? 'bg-red-600 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Todas ({bills.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-1.5 rounded-md font-bold text-xs transition-all flex items-center gap-1.5 ${
              statusFilter === 'pending' 
                ? 'bg-amber-500 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Pendentes ({bills.filter(b => b.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('overdue')}
            className={`px-4 py-1.5 rounded-md font-bold text-xs transition-all flex items-center gap-1.5 ${
              statusFilter === 'overdue' 
                ? 'bg-rose-600 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Atrasadas ({kpis.overdueCount})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-4 py-1.5 rounded-md font-bold text-xs transition-all flex items-center gap-1.5 ${
              statusFilter === 'paid' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            Pagas ({bills.filter(b => b.status === 'paid').length})
          </button>
        </div>

        {/* Category & Search Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-grow md:justify-end">
          {/* Categoria */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-3 py-2 text-xs font-bold text-gray-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 h-10"
          >
            <option value="all">Todas as Categorias</option>
            {categoriesList.map((cat, i) => (
              <option key={i} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Search bar */}
          <div className="relative flex-grow sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar contas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 w-full font-medium h-10"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Date Range & PDF Export Control Panel */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-gray-500 shrink-0">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-bold">Vencimento de:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-600 outline-none focus:border-red-500 h-9"
              title="Data inicial de vencimento"
            />
            <span className="text-xs text-gray-400 font-bold">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-600 outline-none focus:border-red-500 h-9"
              title="Data final de vencimento"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline transition-all"
              >
                Limpar Período
              </button>
            )}
          </div>
        </div>

        {/* Action Button to Export PDF */}
        <button
          onClick={exportToPDF}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-xs cursor-pointer w-full md:w-auto"
        >
          <FileText className="h-4 w-4" /> Exportar Relatório PDF
        </button>
      </div>

      {/* Bills table/list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredBills.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold">Nenhuma conta encontrada</p>
            <p className="text-xs text-gray-400 mt-1">
              Verifique os filtros ou adicione uma nova conta de despesa.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider font-semibold">Descrição</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider font-semibold">Status</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody id="bills-table-body" className="bg-white divide-y divide-gray-100">
                <AnimatePresence mode="popLayout">
                  {filteredBills.map((bill) => {
                    const overdue = isOverdue(bill);
                    return (
                      <motion.tr
                        key={bill.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`transition-all duration-300 border-l-4 ${
                          overdue 
                            ? 'bg-gradient-to-r from-red-50/90 via-rose-50/40 to-white hover:from-red-100/95 hover:via-rose-100/60 hover:to-white border-l-red-500 animate-[pulse_4s_ease-in-out_infinite]' 
                            : 'border-l-transparent hover:bg-gray-50/50'
                        }`}
                      >
                        {/* Vencimento */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {overdue ? (
                              <AlertTriangle className="h-4.5 w-4.5 text-red-600 animate-bounce shrink-0 filter drop-shadow-[0_2px_3px_rgba(239,68,68,0.25)]" />
                            ) : (
                              <Calendar className="h-4 w-4 text-gray-400" />
                            )}
                            <span className={`text-sm font-black ${
                              overdue 
                                ? 'text-red-700 font-extrabold' 
                                : bill.status === 'paid' ? 'text-gray-400 line-through' : 'text-gray-700'
                            }`}>
                              {(() => {
                                try {
                                  if (!bill.dueDate) return '';
                                  const datePart = bill.dueDate.split('T')[0];
                                  const parts = datePart.split('-');
                                  if (parts.length === 3) {
                                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                  }
                                  return format(parseISO(bill.dueDate), 'dd/MM/yyyy');
                                } catch {
                                  return 'Data inválida';
                                }
                              })()}
                            </span>
                          </div>
                        </td>

                        {/* Descrição */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold truncate max-w-xs sm:max-w-md ${
                              bill.status === 'paid' ? 'text-gray-400 line-through' : 'text-gray-900'
                            }`}>
                              {bill.description}
                            </span>
                            {bill.notes && (
                              <span className="text-xs text-gray-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                                {bill.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Categoria */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {bill.category && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                              <Tag className="h-3 w-3 mr-1 text-gray-400" />
                              {bill.category}
                            </span>
                          )}
                        </td>

                        {/* Valor */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`text-sm font-black font-semibold ${
                            bill.status === 'paid' ? 'text-gray-400 font-medium' : 'text-gray-900'
                          }`}>
                            R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleToggleStatus(bill)}
                            className="focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 rounded-lg group"
                            title="Clique para alternar status"
                          >
                            {bill.status === 'paid' ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-emerald-700 border border-green-200 group-hover:bg-emerald-100 transition-colors">
                                <Check className="h-3 w-3 mr-1" /> Pago
                              </span>
                            ) : overdue ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 group-hover:bg-rose-100 transition-colors">
                                <AlertTriangle className="h-3 w-3 mr-1 text-rose-500" /> Atrasado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 group-hover:bg-amber-100 transition-colors">
                                <Clock className="h-3 w-3 mr-1" /> Pendente
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Fast Action Pay/Revert */}
                            <button
                              onClick={() => handleToggleStatus(bill)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                bill.status === 'paid' 
                                  ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200' 
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                              }`}
                              title={bill.status === 'paid' ? 'Marcar como Pendente' : 'Marcar como Pago'}
                            >
                              {bill.status === 'paid' ? (
                                <RotateCcw className="h-4 w-4" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleEditClick(bill)}
                              className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setBillToDelete(bill)}
                              className="p-1.5 rounded-lg border border-transparent bg-transparent text-gray-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-150 flex flex-col"
            >
              <div className="p-5 border-b flex items-center justify-between bg-gray-50/70">
                <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-red-500" />
                  {editingBill ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg bg-gray-150/40 text-gray-400 hover:text-gray-600 transition-all focus:outline-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1">
                {/* Descrição */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição / Favorecido *</label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Fornecedor de lenha, Conta de Energia"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-red-500 outline-none font-medium text-sm transition-all"
                  />
                </div>

                {/* Valor e Data de Vencimento (Grid) */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Valor */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Valor (R$) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm font-bold text-gray-400">R$</span>
                      <input
                        type="text"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="0,00"
                        className="w-full border-2 border-gray-200 rounded-xl py-3 pl-8 pr-3 focus:border-red-500 outline-none font-bold text-sm transition-all"
                      />
                    </div>
                  </div>

                  {/* Vencimento */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento *</label>
                    <input
                      type="date"
                      required
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-red-500 outline-none font-bold text-sm text-gray-700 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria *</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        isCustomCategory: !formData.isCustomCategory,
                        category: !formData.isCustomCategory ? 'custom' : 'Matéria-prima'
                      })}
                      className="text-[10px] font-bold text-red-600 hover:text-red-700 underline focus:outline-none"
                    >
                      {formData.isCustomCategory ? 'Escolher existente' : 'Outra categoria'}
                    </button>
                  </div>

                  {formData.isCustomCategory ? (
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={formData.customCategory}
                      onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                      placeholder="Ex: Fornecedor de Carnes"
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-red-500 outline-none font-medium text-sm transition-all"
                    />
                  ) : (
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-red-500 outline-none font-bold text-sm text-gray-600 transition-all cursor-pointer h-[48px]"
                    >
                      {DEFAULT_CATEGORIES.map((cat, i) => (
                        <option key={i} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Observações */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Observações (opcional)</label>
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Adicione observações ou detalhes extras sobre o boleto ou conta."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-red-500 outline-none font-medium text-sm transition-all resize-none"
                  />
                </div>

                {/* Buttons controls */}
                <div className="flex items-center space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold transition-all text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all text-sm shadow-md hover:shadow-lg"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {billToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-150 p-6 text-center"
            >
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 mb-4 animate-bounce">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-gray-800">Excluir Conta a Pagar?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Tem certeza de que deseja excluir a conta <span className="font-extrabold text-gray-800">"{billToDelete.description}"</span>?
              </p>
              {billToDelete.amount && (
                <p className="text-sm font-black text-red-600 mt-1">
                  Valor: R$ {billToDelete.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-xs text-rose-500 mt-3 bg-rose-50 py-1.5 px-3 rounded-lg border border-rose-100 font-bold">
                Esta ação é irreversível e excluirá o registro permanentemente.
              </p>

              <div className="flex items-center space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setBillToDelete(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-bold transition-all text-xs"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBill(billToDelete.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold transition-all text-xs shadow-md hover:shadow-lg"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
