import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../../core/services/operations.service';
@Component({
  selector: 'app-orders-table',
  imports: [FormsModule],
  templateUrl: './orders-table.html',
})
export class OrdersTable {
  readonly operations = inject(OperationsService);
}
