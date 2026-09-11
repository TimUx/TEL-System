from models import JournalEntry, JournalEntrySource



def create_journal_entry(operation_id, content, assignment_id=None, entry_type='note', source=JournalEntrySource.USER):
    return JournalEntry(
        operation_id=operation_id,
        assignment_id=assignment_id,
        entry_type=entry_type,
        source=source,
        content=content,
    )



def create_system_event(operation_id, content, assignment_id=None, entry_type='system_event'):
    return create_journal_entry(
        operation_id=operation_id,
        assignment_id=assignment_id,
        entry_type=entry_type,
        source=JournalEntrySource.SYSTEM,
        content=content,
    )
