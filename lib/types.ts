export interface PaymentData {
  id?: string
  amount: number
  method: 'cash' | 'credit' | 'debit' | 'pix' | 'transfer'
  status: 'pending' | 'paid' | 'cancelled'
  paymentDate?: Date
  notes?: string
  patientId?: string
  attendanceId?: string
}

export interface AttendanceRecord {
  id: string
  sessionDate: Date
  status: 'present' | 'absent' | 'late' | 'cancelled'
  paymentId?: string
  payment?: PaymentData
  notes?: string
}
