module RS 
  class ScrumReporter
    attr_reader :data

    def initialize(project, version)
      @project = project
      @version = version

      run
      set_up_day_range
      set_up_day_data
    end

    private

    def set_up_day_data
      @data = {}
      @data[:ideal_line] = []
      @data[:remain_line] = []
      @data[:issue_ids] = []
      @data[:days] = @days.to_a.map(&:to_s)
      @data[:rows] = []
      rate = (@days.to_a.size > 1) ? @sum_estimated_hours / (@days.to_a.size - 1) : 0
      @days.to_a.each_with_index do |day, idx|
        @data[day] = {}
        sum_data = {}
        sum_data[:spent] = 0
        sum_data[:left] = 0
        @issues.each do |issue|
          issue_data = {}

          issue_entries = issue.time_entries.select{ |te| te.spent_on == day }.sort_by(&:updated_on)
          entry = issue_entries.last

          if entry.try(:te_remaining_hours).present?
            issue.left_hours = entry.te_remaining_hours.to_f
          end

          issue_data[:id] = issue.id
          issue_data[:left] = issue.left_hours.to_f
          issue_data[:spent] = issue_entries.compact.sum(&:hours)
          issue_data[:has_time_entry] = (issue_entries.present? ? true : false)
          issue_data[:assignee_te] = issue_entries.find{ |te| te.user_id == issue.assigned_to_id }
          issue_data[:story_id] = issue.parent_id
          @data[day][issue.id] = issue_data

          if issue.parent_id.present?
            @data[day][issue.parent_id] = { :left => 0, :spent => 0 } unless @data[day][issue.parent_id].present?
            @data[day][issue.parent_id][:left] += issue_data[:left]
            @data[day][issue.parent_id][:spent] += issue_data[:spent]
            # order matter when adding issues ids
            @data[:issue_ids] << issue.parent_id
          end
          @data[:issue_ids] << issue.id

          sum_data[:spent] += issue_data[:spent]
          sum_data[:left] += issue_data[:left]
        end

        @data[day][:sum] = sum_data
        @data[:ideal_line] << [ day.to_s, (@sum_estimated_hours - idx * rate) ]
        @data[:remain_line] << [ day.to_s, idx == 0 ? (@sum_estimated_hours - idx * rate) : sum_data[:left] ]
      end
      @sum_remaining_hours = @data[@days.last][:sum][:left]
      @data[:sum_estimated_hours] = @sum_estimated_hours
      @data[:sum_remain_hours] = @data[@days.last][:sum][:left]
      @data[:issue_ids].uniq!

      # TODO: new data structure for ko
      parents = []
      parent_row = {}
      @issues.each do |issue|
        if issue.parent_id.present?
          parent = Issue.find(issue.parent_id)
          unless parents.include?(parent.id)
            parent_row[:story_title] = parent.subject
            parent_row[:issue_title] = parent.subject
            parent_row[:assignee] = "#{parent.assigned_to}"
            parent_row[:status] = "#{parent.status}"
            parent_row[:cells] = []
            @data[:rows] << parent_row
          end
          parents << parent.id
        end

        row = {
          :story_title => ((parent) ? parent.subject : ""),
          :issue_title => issue.subject,
          :assignee => "#{issue.assigned_to}",
          :status => "#{issue.status}"
        }
        row[:cells] = []

        parent_spent = 0
        parent_left = nil

        @days.to_a.each_with_index do |day, idx|
          cell = {}
          issue_entries = issue.time_entries.select{ |te| te.spent_on == day }.sort_by(&:updated_on)
          entry = issue_entries.last
          if entry.try(:te_remaining_hours).present?
            issue.left_hours = entry.te_remaining_hours.to_f
          end
          cell[:id] = issue.id
          cell[:left] = issue.left_hours.to_f
          cell[:spent] = issue_entries.compact.sum(&:hours)
          cell[:has_time_entry] = (issue_entries.present? ? true : false)
          cell[:assignee_te] = issue_entries.find{ |te| te.user_id == issue.assigned_to_id }
          cell[:story_id] = issue.parent_id
          row[:cells] << cell
        end

        @data[:rows] << row
      end
    end

    def run
      default_conditions
      if @version
        @conditions += " AND issues.fixed_version_id = :version_id"
        @condition_vars.merge!({ 
          :version_id => @version.id 
        })
      end
      @issues = Issue.all(:select => "issues.id, 
                           issues.parent_id,
                           issues.status_id, 
                           issues.tracker_id,
                           issues.subject, 
                           COALESCE(issues.remaining_hours, 0) AS remaining_hours,
                           COALESCE(issues.estimated_hours, 0) AS estimated_hours,
                           COALESCE(issues.estimated_hours, 0) AS left_hours,
                           issues.assigned_to_id,
                           sum(time_entries.hours) AS spent_time,
                           min(time_entries.spent_on) AS first_time_entry,
                           max(time_entries.spent_on) AS last_time_entry",
                           :joins => "LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)",# LEFT JOIN versions ON issues.fixed_version_id = versions.id",
                           :include => [ :status, :assigned_to, :tracker ],
                           :conditions => [ @conditions, @condition_vars ],
                           :group => 'issues.id',
                           :order => 'issues.parent_id DESC, issues.id ASC')
      @sum_estimated_hours = @issues.sum(&:estimated_hours) 
      @sum_spent_hours = @issues.map(&:spent_time).compact.map(&:to_f).sum
    end

    def default_conditions
      @conditions = "issues.project_id = :project_id 
                  AND issues.tracker_id = :tracker_id
                  AND issues.estimated_hours IS NOT NULL"
                  #AND versions.status != 'closed'"
      @condition_vars = { 
        :project_id => @project.id,
        :tracker_id => RbTask.tracker
      }
    end

    def set_up_day_range
      first_time_entry = @issues.map(&:first_time_entry).compact.min
      last_time_entry = @issues.map(&:last_time_entry).compact.max
      first_time_entry = Date.parse(first_time_entry) if first_time_entry
      last_time_entry = Date.parse(last_time_entry) if last_time_entry

      from = []
      to = []

      unless @version 
        sprint_start = @project.versions.open.map(&:sprint_start_date).compact.min
        sprint_end = @project.versions.open.map(&:effective_date).compact.max

        from << first_time_entry if first_time_entry
        from << sprint_start if sprint_start
        @from = from.min
        unless @from.present?
          from << @project.versions.min_by(&:created_on).created_on.to_date if @project.versions.min_by(&:created_on).present?
          @from = from.min || Date.today
        end

        to << last_time_entry if last_time_entry
        to << sprint_end if sprint_end
        @to = to.max
        unless @to.present?
          to << @project.versions.max_by(&:created_on).created_on.to_date if @project.versions.max_by(&:created_on).present?
          @to = to.max || Date.today
        end
      else
        sprint_start = @version.try(:sprint_start_date)
        sprint_end = @version.try(:effective_date)

        from << sprint_start if sprint_start.present?
        @from = from.min
        @from = [ @version.try(:created_on).to_date, Date.today ].min unless @from.present? unless @from.present?

        to << sprint_end if sprint_end.present?
        @to = to.max
        @to = [ @version.try(:created_on).to_date, Date.today].max unless @to.present?
       end

      @days = (@from..@to)
    end

  end
end
