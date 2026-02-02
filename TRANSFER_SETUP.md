# Transfer Management System - Setup Instructions

## Database Setup

Run the following SQL migration to create the transfer_requests table:

```bash
# Connect to your PostgreSQL database
psql -U assetiq_user -d assetiq -f add_transfer_table.sql
```

Or manually execute the SQL from `add_transfer_table.sql` in your database client.

## How It Works

### For Lab Incharge / Lab Assistant:

1. Navigate to **Transfers** page
2. Select **From Lab** (source lab containing devices)
3. Select **To Lab** (destination lab)
4. Click **"Select Devices"** button to browse available devices in source lab
5. Click on devices to select/deselect them (multi-select supported)
6. Add optional remark/notes
7. Click **"Submit Transfer Request"**
8. Request will be sent to HOD for approval

### For HOD (Head of Department):

1. Navigate to **Transfers** page
2. Click on **"Pending Approvals"** tab to see all transfer requests
3. Review each request showing:
   - Source and destination labs
   - List of devices to be transferred
   - Requester name and timestamp
   - Remarks/notes
4. Click **"✓ Approve"** to approve and automatically move devices
5. Click **"✗ Reject"** to reject the request

## Transfer Process Flow

```
Lab Incharge/Assistant → Fill Form → Submit Request → Pending Status
                                           ↓
                                    HOD Reviews
                                           ↓
                              ┌────────────┴────────────┐
                              ↓                         ↓
                         Approve                    Reject
                              ↓                         ↓
                   Devices Moved to                Request
                   Destination Lab               Marked Rejected
                   (lab_id updated)
```

## User Role Configuration

Make sure users have the correct role stored in localStorage:

- For HOD: `localStorage.setItem("userRole", "hod")`
- For Lab Incharge/Assistant: `localStorage.setItem("userRole", "lab_incharge")`

The role is automatically fetched on page load to show appropriate views.

## Features

✅ Browse devices by lab
✅ Multi-device selection (individual items or entire groups)
✅ Real-time device availability
✅ Approval workflow with HOD authorization
✅ Automatic database updates on approval
✅ Transfer history tracking (requested_by, approved_by, timestamps)
✅ Status tracking (pending/approved/rejected)
✅ Remark/notes field for additional context

## Database Schema

The `transfer_requests` table stores:

- `transfer_id`: Unique ID for each request
- `from_lab_id`: Source lab
- `to_lab_id`: Destination lab
- `device_ids`: JSON array of device IDs
- `remark`: Optional notes
- `status`: pending/approved/rejected
- `requested_by`: User who created request
- `requested_at`: Timestamp of request creation
- `approved_by`: User who approved/rejected
- `approved_at`: Timestamp of approval/rejection

## API Endpoints

- `GET /get_lab_devices/<lab_id>` - Get all devices in a lab
- `POST /create_transfer_request` - Create new transfer request
- `GET /get_pending_transfers` - Get all pending requests (HOD view)
- `POST /approve_transfer/<transfer_id>` - Approve and execute transfer
- `POST /reject_transfer/<transfer_id>` - Reject transfer request
